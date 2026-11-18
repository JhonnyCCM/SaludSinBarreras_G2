//! Preparación de texto para lector de pantalla y lectura en voz alta en tiempo real.
//!
//! - Expande abreviaturas médicas para que la voz no lea "mg" o "c/8h" letra por letra.
//! - Divide en segmentos cortos (≤ 160 caracteres) para leerlos sin cortar ideas.
//! - Marca como urgentes las señales de alarma: el frontend las anuncia en la región `assertive`.

use std::sync::LazyLock;

use regex::Regex;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Prioridad {
    Cortes,
    Urgente,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Segmento {
    pub texto: String,
    pub prioridad: Prioridad,
    pub hablante: Option<String>,
    pub pausa_ms: u32,
}

const MAX_SEGMENTO: usize = 160;

static ABREVIATURAS: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
    [
        (r"(?i)\bdra\.", "doctora"),
        (r"(?i)\bdr\.", "doctor"),
        (r"(?i)\blic\.", "licenciada"),
        (r"(?i)c/\s*(\d+)\s*h\b", "cada $1 horas"),
        (r"(?i)(\d)\s*mg\b", "$1 miligramos"),
        (r"(?i)(\d)\s*ml\b", "$1 mililitros"),
        (r"(?i)(\d)\s*ui\b", "$1 unidades"),
        (r"(?i)(\d)\s*°\s*c\b", "$1 grados"),
        (r"(\d)\s*%", "$1 por ciento"),
        (r"(\d),(\d)", "$1 coma $2"),
        (r"\bLSEc\b", "lengua de señas ecuatoriana"),
        (r"\bMSP\b", "Ministerio de Salud Pública"),
        (r"\bIA\b", "inteligencia artificial"),
        (r"(?i)\bvía oral\b", "por la boca"),
    ]
    .iter()
    .map(|(p, r)| (Regex::new(p).expect("regex válida"), *r))
    .collect()
});

static URGENTE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)urgencia|emergencia|alarma|de inmediato|inmediatamente|llame al 911|dificultad para respirar|dolor (fuerte|intenso)")
        .expect("regex válida")
});

pub fn expandir(texto: &str) -> String {
    let mut t = texto.to_string();
    for (re, rep) in ABREVIATURAS.iter() {
        t = re.replace_all(&t, *rep).into_owned();
    }
    t.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Divide en oraciones y, si alguna es muy larga, la corta por comas o espacios.
fn trocear(texto: &str) -> Vec<String> {
    let mut oraciones = Vec::new();
    let mut actual = String::new();
    for c in texto.chars() {
        actual.push(c);
        if matches!(c, '.' | '?' | '!' | ';' | '\n') {
            oraciones.push(std::mem::take(&mut actual));
        }
    }
    oraciones.push(actual);

    let mut segmentos = Vec::new();
    for o in oraciones.iter().map(|o| o.trim()).filter(|o| !o.is_empty()) {
        if o.chars().count() <= MAX_SEGMENTO {
            segmentos.push(o.to_string());
            continue;
        }
        let mut trozo = String::new();
        for palabra in o.split(' ') {
            if trozo.chars().count() + palabra.chars().count() + 1 > MAX_SEGMENTO && !trozo.is_empty() {
                segmentos.push(std::mem::take(&mut trozo).trim().to_string());
            }
            trozo.push_str(palabra);
            trozo.push(' ');
            if palabra.ends_with(',') && trozo.chars().count() > MAX_SEGMENTO / 2 {
                segmentos.push(std::mem::take(&mut trozo).trim().to_string());
            }
        }
        if !trozo.trim().is_empty() {
            segmentos.push(trozo.trim().to_string());
        }
    }
    segmentos
}

pub fn preparar(texto: &str, hablante: Option<&str>) -> Vec<Segmento> {
    let expandido = expandir(texto);
    let trozos = trocear(&expandido);
    let total = trozos.len();
    trozos
        .into_iter()
        .enumerate()
        .map(|(i, t)| Segmento {
            prioridad: if URGENTE.is_match(&t) { Prioridad::Urgente } else { Prioridad::Cortes },
            // Se anuncia quién habla solo en el primer segmento de su intervención.
            texto: match (i, hablante) {
                (0, Some(h)) if !h.is_empty() => format!("{}: {t}", expandir(h)),
                _ => t,
            },
            hablante: hablante.map(str::to_string),
            pausa_ms: if i + 1 == total { 0 } else { 300 },
        })
        .collect()
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn expande_abreviaturas_medicas() {
        assert_eq!(expandir("Losartán 50 mg c/24h"), "Losartán 50 miligramos cada 24 horas");
        assert_eq!(expandir("Dra. Viteri, timolol 0,5 %"), "doctora Viteri, timolol 0 coma 5 por ciento");
    }

    #[test]
    fn marca_alarmas_como_urgentes() {
        let s = preparar("Tome agua. Si tiene dificultad para respirar acuda a urgencias.", None);
        assert_eq!(s.len(), 2);
        assert_eq!(s[0].prioridad, Prioridad::Cortes);
        assert_eq!(s[1].prioridad, Prioridad::Urgente);
    }

    #[test]
    fn anuncia_hablante_y_corta_textos_largos() {
        let largo = "palabra ".repeat(60);
        let s = preparar(&largo, Some("Dra. Viteri"));
        assert!(s.len() >= 3);
        assert!(s[0].texto.starts_with("doctora Viteri:"));
        assert!(s.iter().all(|x| x.texto.chars().count() <= MAX_SEGMENTO + 20));
    }
}
