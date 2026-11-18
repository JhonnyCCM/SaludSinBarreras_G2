//! Glosador de Lengua de Señas Ecuatoriana (LSEc) por reglas.
//!
//! Convierte texto en español (por ejemplo, la transcripción de la consulta) en una secuencia de
//! glosas que el frontend muestra como tarjetas animadas junto al video del intérprete.
//! Reglas aplicadas, inspiradas en la gramática de las lenguas de señas:
//! 1. Se omiten artículos, preposiciones y verbos copulativos.
//! 2. Se reconocen expresiones médicas de varias palabras ("dolor de cabeza" → DOLOR-CABEZA).
//! 3. Las marcas de tiempo van al inicio de la oración (HOY, MAÑANA, CADA-DÍA…).
//! 4. En preguntas abiertas el pronombre interrogativo va al final, con expresión facial.
//! 5. La negación NO se coloca al final de la oración.
//! 6. Palabras fuera del léxico se deletrean con dactilología.
//!
//! Es un apoyo visual: NO reemplaza al intérprete humano acreditado (RF-18 a RF-22).

use std::collections::HashMap;
use std::sync::LazyLock;

use serde::Serialize;

pub const AVISO: &str = "Glosas LSEc generadas por reglas como apoyo visual. No reemplazan al intérprete \
acreditado, que es quien interpreta la consulta.";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TipoGlosa {
    Lexica,
    Dactilologia,
    Numero,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Glosa {
    pub glosa: String,
    pub tipo: TipoGlosa,
    pub original: String,
    pub pictograma: Option<&'static str>,
    pub duracion_ms: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Oracion {
    pub glosas: Vec<Glosa>,
    /// "abierta" (qué, cómo, cuándo…), "cerrada" (sí/no) o None si es afirmación.
    pub pregunta: Option<&'static str>,
    pub expresion_facial: Option<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Traduccion {
    pub oraciones: Vec<Oracion>,
    pub texto_glosado: String,
    /// Proporción de glosas léxicas o numéricas (el resto va deletreado).
    pub cobertura: f32,
    pub duracion_total_ms: u32,
    pub aviso: &'static str,
}

/// (glosa, pictograma)
type Entrada = (&'static str, Option<&'static str>);

static FRASES: LazyLock<Vec<(&'static str, Entrada)>> = LazyLock::new(|| {
    let mut v = vec![
        ("dolor de cabeza", ("DOLOR-CABEZA", Some("dolor"))),
        ("dolor de garganta", ("DOLOR-GARGANTA", Some("dolor"))),
        ("dolor de estomago", ("DOLOR-ESTÓMAGO", Some("dolor"))),
        ("dolor de pecho", ("DOLOR-PECHO", Some("alerta"))),
        ("presion arterial", ("PRESIÓN-SANGRE", Some("corazon"))),
        ("falta de aire", ("RESPIRAR DIFÍCIL", Some("alerta"))),
        ("dificultad para respirar", ("RESPIRAR DIFÍCIL", Some("alerta"))),
        ("por la manana", ("MAÑANA", Some("sol"))),
        ("en la manana", ("MAÑANA", Some("sol"))),
        ("cada manana", ("CADA-MAÑANA", Some("sol"))),
        ("por la noche", ("NOCHE", Some("luna"))),
        ("en la noche", ("NOCHE", Some("luna"))),
        ("por la tarde", ("TARDE", None)),
        ("antes de comer", ("ANTES COMER", Some("comer"))),
        ("despues de comer", ("DESPUÉS COMER", Some("comer"))),
        ("antes del desayuno", ("ANTES DESAYUNO", Some("comer"))),
        ("despues del desayuno", ("DESPUÉS DESAYUNO", Some("comer"))),
        ("buenos dias", ("BUENOS-DÍAS", None)),
        ("buenas tardes", ("BUENAS-TARDES", None)),
        ("muchas gracias", ("GRACIAS", None)),
        ("lengua de senas", ("LENGUA-SEÑAS", Some("manos"))),
        ("todos los dias", ("CADA-DÍA", Some("calendario"))),
        ("cada dia", ("CADA-DÍA", Some("calendario"))),
        ("otra vez", ("OTRA-VEZ", None)),
        ("de nuevo", ("OTRA-VEZ", None)),
        ("por que", ("POR-QUÉ", None)),
        ("vision borrosa", ("VER BORROSO", Some("ojo"))),
    ];
    // Las más largas primero para que "dolor de cabeza" gane a "dolor".
    v.sort_by_key(|(f, _)| std::cmp::Reverse(f.len()));
    v
});

static LEXICO: LazyLock<HashMap<&'static str, Entrada>> = LazyLock::new(|| {
    let grupos: &[(&[&str], Entrada)] = &[
        (&["yo"], ("YO", None)),
        (&["usted", "tu", "ustedes"], ("TÚ", None)),
        (&["ella"], ("ELLA", None)),
        (&["doctor", "doctora", "medico", "medica", "dr", "dra"], ("MÉDICO", Some("medico"))),
        (&["paciente"], ("PACIENTE", None)),
        (&["enfermera", "enfermero"], ("ENFERMERA", Some("medico"))),
        (&["interprete"], ("INTÉRPRETE", Some("manos"))),
        (&["hola"], ("HOLA", None)),
        (&["gracias"], ("GRACIAS", None)),
        (&["adios", "chao"], ("ADIÓS", None)),
        (&["si"], ("SÍ", None)),
        (&["no"], ("NO", None)),
        (&["bien"], ("BIEN", None)),
        (&["mal"], ("MAL", None)),
        (&["ayuda", "ayudar", "ayudo"], ("AYUDAR", None)),
        (&["entender", "entiende", "entiendo", "entendio", "comprende", "comprendio"], ("ENTENDER", None)),
        (&["repetir", "repita", "repito"], ("REPETIR", None)),
        (&["esperar", "espere", "espero"], ("ESPERAR", Some("reloj"))),
        (&["dolor", "duele", "doler", "molestia", "molesta"], ("DOLOR", Some("dolor"))),
        (&["fiebre", "temperatura"], ("FIEBRE", Some("termometro"))),
        (&["tos"], ("TOS", None)),
        (&["gripe", "resfriado"], ("GRIPE", None)),
        (&["mareo", "mareos", "mareado", "mareada", "mareo"], ("MAREO", None)),
        (&["cansado", "cansada", "cansancio"], ("CANSADO", None)),
        (&["vomito", "vomitar", "vomitos"], ("VOMITAR", None)),
        (&["diarrea"], ("DIARREA", None)),
        (&["sangre"], ("SANGRE", None)),
        (&["presion"], ("PRESIÓN", Some("corazon"))),
        (&["azucar", "diabetes", "glucosa"], ("AZÚCAR", None)),
        (&["corazon"], ("CORAZÓN", Some("corazon"))),
        (&["cabeza"], ("CABEZA", None)),
        (&["garganta"], ("GARGANTA", None)),
        (&["estomago", "barriga"], ("ESTÓMAGO", None)),
        (&["ojo", "ojos"], ("OJO", Some("ojo"))),
        (&["oido", "oidos", "oreja"], ("OÍDO", None)),
        (&["pecho"], ("PECHO", None)),
        (&["espalda"], ("ESPALDA", None)),
        (&["brazo", "brazos"], ("BRAZO", None)),
        (&["pierna", "piernas"], ("PIERNA", None)),
        (&["mano", "manos"], ("MANO", Some("manos"))),
        (&["medicina", "medicamento", "medicamentos", "remedio", "remedios", "medicacion"], ("MEDICINA", Some("pastilla"))),
        (&["pastilla", "pastillas", "tableta", "tabletas", "comprimido", "capsula", "capsulas"], ("PASTILLA", Some("pastilla"))),
        (&["jarabe"], ("JARABE", Some("jarabe"))),
        (&["gota", "gotas", "colirio"], ("GOTAS", Some("gotas"))),
        (&["inyeccion", "vacuna"], ("INYECCIÓN", Some("inyeccion"))),
        (&["inhalador"], ("INHALADOR", Some("inhalador"))),
        (&["receta"], ("RECETA", Some("receta"))),
        (&["dosis"], ("DOSIS", Some("pastilla"))),
        (&["tomar", "tome", "toma", "tomo", "tomarla", "tomarlo", "tomando"], ("TOMAR", Some("pastilla"))),
        (&["aplicar", "aplique", "ponga", "poner"], ("APLICAR", Some("gotas"))),
        (&["comer", "coma", "comida", "comidas", "como"], ("COMER", Some("comer"))),
        (&["desayuno"], ("DESAYUNO", Some("comer"))),
        (&["almuerzo"], ("ALMUERZO", Some("comer"))),
        (&["cena"], ("CENA", Some("comer"))),
        (&["agua", "liquidos"], ("AGUA", Some("agua"))),
        (&["sal"], ("SAL", None)),
        (&["beber", "beba"], ("BEBER", Some("agua"))),
        (&["dormir", "duerma", "duermo", "sueno"], ("DORMIR", Some("luna"))),
        (&["descansar", "descanse", "reposo"], ("DESCANSAR", Some("cama"))),
        (&["caminar", "camine"], ("CAMINAR", None)),
        (&["trabajar", "trabajo", "trabaja"], ("TRABAJAR", None)),
        (&["medir", "mida", "medirse"], ("MEDIR", None)),
        (&["examen", "examenes", "analisis", "laboratorio"], ("EXAMEN", Some("laboratorio"))),
        (&["resultado", "resultados"], ("RESULTADO", Some("laboratorio"))),
        (&["cita", "citas"], ("CITA", Some("calendario"))),
        (&["control"], ("CONTROL", Some("calendario"))),
        (&["consulta"], ("CONSULTA", Some("medico"))),
        (&["hospital", "clinica"], ("HOSPITAL", Some("hospital"))),
        (&["urgencia", "urgencias", "emergencia"], ("URGENCIA", Some("alerta"))),
        (&["llamar", "llame"], ("LLAMAR", None)),
        (&["volver", "vuelva", "regresar", "regrese"], ("VOLVER", None)),
        (&["ir", "acuda", "acudir", "vaya"], ("IR", None)),
        (&["hoy"], ("HOY", Some("calendario"))),
        (&["lunes"], ("LUNES", Some("calendario"))),
        (&["martes"], ("MARTES", Some("calendario"))),
        (&["miercoles"], ("MIÉRCOLES", Some("calendario"))),
        (&["jueves"], ("JUEVES", Some("calendario"))),
        (&["viernes"], ("VIERNES", Some("calendario"))),
        (&["sabado"], ("SÁBADO", Some("calendario"))),
        (&["domingo"], ("DOMINGO", Some("calendario"))),
        (&["manana"], ("MAÑANA", Some("sol"))),
        (&["ayer"], ("AYER", Some("calendario"))),
        (&["ahora"], ("AHORA", None)),
        (&["despues", "luego"], ("DESPUÉS", None)),
        (&["antes"], ("ANTES", None)),
        (&["siempre"], ("SIEMPRE", None)),
        (&["nunca"], ("NUNCA", None)),
        (&["dia", "dias"], ("DÍA", Some("calendario"))),
        (&["semana", "semanas"], ("SEMANA", Some("calendario"))),
        (&["mes", "meses"], ("MES", Some("calendario"))),
        (&["hora", "horas"], ("HORA", Some("reloj"))),
        (&["minuto", "minutos"], ("MINUTO", Some("reloj"))),
        (&["noche"], ("NOCHE", Some("luna"))),
        (&["tarde"], ("TARDE", None)),
        (&["cada"], ("CADA", Some("reloj"))),
        (&["que"], ("QUÉ", None)),
        (&["cuando"], ("CUÁNDO", None)),
        (&["donde"], ("DÓNDE", None)),
        (&["cuanto", "cuanta", "cuantos", "cuantas"], ("CUÁNTO", None)),
        (&["quien"], ("QUIÉN", None)),
        (&["mucho", "mucha", "muchos"], ("MUCHO", None)),
        (&["poco", "poca"], ("POCO", None)),
        (&["mas"], ("MÁS", None)),
        (&["menos", "reducir", "reduzca"], ("MENOS", None)),
        (&["fuerte", "intenso", "intensa"], ("FUERTE", None)),
        (&["poder", "puedo", "puede", "podemos"], ("PODER", None)),
        (&["necesitar", "necesito", "necesita"], ("NECESITAR", None)),
        (&["querer", "quiero", "quiere"], ("QUERER", None)),
        (&["tener", "tengo", "tiene", "tienen"], ("TENER", None)),
        (&["seguir", "siga", "continuar", "continuamos", "continue"], ("SEGUIR", None)),
        (&["sentir", "siente", "siento", "sentido"], ("SENTIR", None)),
        (&["ver", "vemos", "vea"], ("VER", Some("ojo"))),
        (&["recordar", "recuerde", "olvidar", "olvidan", "olvida"], ("RECORDAR", None)),
        (&["empezar", "empezo", "empieza", "comenzo", "comenzar", "inicio"], ("EMPEZAR", None)),
        (&["terminar", "termino", "termine", "acabar"], ("TERMINAR", None)),
        (&["pasar", "paso", "pasa"], ("PASAR", None)),
        (&["hablar", "habla", "hable"], ("HABLAR", None)),
        (&["escribir", "escriba", "escribo"], ("ESCRIBIR", None)),
        (&["decir", "dice", "digo", "diga"], ("DECIR", None)),
        (&["saber", "sabe", "sabes"], ("SABER", None)),
        (&["uno", "una"], ("1", None)),
        (&["dos"], ("2", None)),
        (&["tres"], ("3", None)),
        (&["cuatro"], ("4", None)),
        (&["cinco"], ("5", None)),
    ];
    let mut m = HashMap::new();
    for (palabras, entrada) in grupos {
        for p in *palabras {
            m.insert(*p, *entrada);
        }
    }
    m
});

/// Palabras que se omiten (artículos, preposiciones, cópulas, conectores).
const OMITIDAS: &[&str] = &[
    "el", "la", "los", "las", "un", "unos", "unas", "de", "del", "a", "al", "en", "por", "para", "con", "se", "lo", "le",
    "les", "me", "te", "nos", "mi", "mis", "su", "sus", "y", "e", "o", "u", "pero", "muy", "es", "son", "esta", "estan",
    "estoy", "ser", "estar", "hay", "este", "esto", "ese", "eso", "sobre", "hasta", "desde", "sin", "tambien", "ya", "va",
];

const TEMPORALES: &[&str] = &[
    "HOY", "MAÑANA", "AYER", "AHORA", "NOCHE", "TARDE", "CADA-DÍA", "CADA-MAÑANA", "SIEMPRE", "NUNCA", "BUENOS-DÍAS",
    "BUENAS-TARDES", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO",
];
const INTERROGATIVOS: &[&str] = &["QUÉ", "CÓMO", "CUÁNDO", "DÓNDE", "CUÁNTO", "QUIÉN", "POR-QUÉ"];

/// Minúsculas y sin tildes (la ñ se conserva como "n" solo para buscar en el léxico).
pub fn normalizar(texto: &str) -> String {
    texto
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' => 'a',
            'é' | 'è' | 'ë' => 'e',
            'í' | 'ì' | 'ï' => 'i',
            'ó' | 'ò' | 'ö' => 'o',
            'ú' | 'ù' | 'ü' => 'u',
            'ñ' => 'n',
            otro => otro,
        })
        .collect()
}

fn duracion(tipo: TipoGlosa, glosa: &str) -> u32 {
    match tipo {
        TipoGlosa::Lexica => 750,
        TipoGlosa::Numero => 600,
        TipoGlosa::Dactilologia => 320 * glosa.chars().filter(|c| c.is_alphabetic()).count() as u32,
    }
}

fn glosa(texto: &str, tipo: TipoGlosa, original: &str, pictograma: Option<&'static str>) -> Glosa {
    Glosa { glosa: texto.to_string(), tipo, original: original.to_string(), pictograma, duracion_ms: duracion(tipo, texto) }
}

fn deletrear(palabra: &str) -> String {
    palabra
        .to_uppercase()
        .chars()
        .filter(|c| c.is_alphabetic())
        .map(|c| c.to_string())
        .collect::<Vec<_>>()
        .join("-")
}

/// Traduce una oración ya separada.
fn traducir_oracion(original: &str) -> Option<Oracion> {
    let es_pregunta = original.contains('?') || original.contains('¿');
    // Palabras originales y normalizadas en paralelo (para conservar tildes en la dactilología).
    let palabras_orig: Vec<&str> = original
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect();
    let norm: Vec<String> = palabras_orig.iter().map(|w| normalizar(w)).collect();

    let mut glosas: Vec<Glosa> = Vec::new();
    let mut i = 0;
    'palabras: while i < norm.len() {
        // 1. Expresiones de varias palabras
        for (frase, (g, p)) in FRASES.iter() {
            let n = frase.split(' ').count();
            if i + n <= norm.len() && norm[i..i + n].join(" ") == *frase {
                glosas.push(glosa(g, TipoGlosa::Lexica, &palabras_orig[i..i + n].join(" "), *p));
                i += n;
                continue 'palabras;
            }
        }
        let w = norm[i].as_str();
        let o = palabras_orig[i];
        if w.chars().all(|c| c.is_ascii_digit()) {
            glosas.push(glosa(w, TipoGlosa::Numero, o, None));
        } else if let Some((g, p)) = LEXICO.get(w) {
            let tipo = if g.chars().all(|c| c.is_ascii_digit()) { TipoGlosa::Numero } else { TipoGlosa::Lexica };
            glosas.push(glosa(g, tipo, o, *p));
        } else if !OMITIDAS.contains(&w) && w.chars().count() >= 2 {
            glosas.push(glosa(&deletrear(o), TipoGlosa::Dactilologia, o, None));
        }
        i += 1;
    }

    if glosas.is_empty() {
        return None;
    }

    // 3. Marcas de tiempo al inicio (orden estable)
    let (mut tiempo, mut resto): (Vec<Glosa>, Vec<Glosa>) =
        glosas.into_iter().partition(|g| TEMPORALES.contains(&g.glosa.as_str()));

    // 4 y 5. Interrogativo y negación al final
    let mut pregunta = None;
    let mut expresion = None;
    let mut finales = Vec::new();
    if es_pregunta {
        let (wh, otros): (Vec<Glosa>, Vec<Glosa>) =
            resto.into_iter().partition(|g| INTERROGATIVOS.contains(&g.glosa.as_str()));
        resto = otros;
        if wh.is_empty() {
            pregunta = Some("cerrada");
            expresion = Some("Cejas levantadas y cabeza inclinada hacia adelante (pregunta de sí o no).");
        } else {
            pregunta = Some("abierta");
            expresion = Some("Cejas fruncidas durante la pregunta (qué, cómo, cuándo…).");
            finales.extend(wh);
        }
    }
    if let Some(pos) = resto.iter().position(|g| g.glosa == "NO") {
        if resto.len() > 1 {
            let no = resto.remove(pos);
            finales.insert(0, no);
        }
    }

    tiempo.append(&mut resto);
    tiempo.append(&mut finales);
    if tiempo.is_empty() {
        return None;
    }
    Some(Oracion { glosas: tiempo, pregunta, expresion_facial: expresion })
}

pub fn traducir(texto: &str) -> Traduccion {
    let mut oraciones = Vec::new();
    let mut actual = String::new();
    for c in texto.chars() {
        actual.push(c);
        if matches!(c, '.' | '?' | '!' | ';' | '\n') {
            if let Some(o) = traducir_oracion(&actual) {
                oraciones.push(o);
            }
            actual.clear();
        }
    }
    if let Some(o) = traducir_oracion(&actual) {
        oraciones.push(o);
    }

    let todas: Vec<&Glosa> = oraciones.iter().flat_map(|o| o.glosas.iter()).collect();
    let lexicas = todas.iter().filter(|g| g.tipo != TipoGlosa::Dactilologia).count();
    let cobertura = if todas.is_empty() { 0.0 } else { lexicas as f32 / todas.len() as f32 };
    let texto_glosado = oraciones
        .iter()
        .map(|o| {
            let s = o.glosas.iter().map(|g| g.glosa.as_str()).collect::<Vec<_>>().join(" ");
            if o.pregunta.is_some() { format!("{s}?") } else { s }
        })
        .collect::<Vec<_>>()
        .join(" // ");
    // Pausa de 400 ms entre oraciones
    let duracion_total_ms = todas.iter().map(|g| g.duracion_ms).sum::<u32>() + 400 * oraciones.len() as u32;

    Traduccion { oraciones, texto_glosado, cobertura: (cobertura * 100.0).round() / 100.0, duracion_total_ms, aviso: AVISO }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn omite_articulos_y_reconoce_frases_medicas() {
        let t = traducir("Me duele la cabeza.");
        assert_eq!(t.texto_glosado, "DOLOR CABEZA");
        let t = traducir("Tengo dolor de cabeza.");
        assert_eq!(t.texto_glosado, "TENER DOLOR-CABEZA");
    }

    #[test]
    fn tiempo_al_inicio() {
        let t = traducir("Tome la pastilla por la mañana.");
        assert_eq!(t.texto_glosado, "MAÑANA TOMAR PASTILLA");
    }

    #[test]
    fn interrogativo_al_final_con_expresion() {
        let t = traducir("¿Cuándo tomo el jarabe?");
        assert_eq!(t.texto_glosado, "TOMAR JARABE CUÁNDO?");
        assert_eq!(t.oraciones[0].pregunta, Some("abierta"));
        assert!(t.oraciones[0].expresion_facial.is_some());
    }

    #[test]
    fn pregunta_cerrada_y_negacion_al_final() {
        let t = traducir("¿Puede trabajar?");
        assert_eq!(t.oraciones[0].pregunta, Some("cerrada"));
        let t = traducir("No tome sal.");
        assert_eq!(t.texto_glosado, "TOMAR SAL NO");
    }

    #[test]
    fn deletrea_palabras_desconocidas_y_numeros() {
        let t = traducir("Losartán 50 mg cada 24 horas.");
        let g: Vec<_> = t.oraciones[0].glosas.iter().map(|g| (g.glosa.as_str(), g.tipo)).collect();
        assert_eq!(g[0], ("L-O-S-A-R-T-Á-N", TipoGlosa::Dactilologia));
        assert_eq!(g[1], ("50", TipoGlosa::Numero));
        assert!(t.cobertura > 0.5);
    }

    #[test]
    fn dias_de_la_semana_van_al_inicio() {
        let t = traducir("Me duele la garganta desde el lunes.");
        assert_eq!(t.texto_glosado, "LUNES DOLOR GARGANTA");
    }

    #[test]
    fn varias_oraciones() {
        let t = traducir("Hola. ¿Cómo está usted?");
        assert_eq!(t.oraciones.len(), 2);
        assert!(t.texto_glosado.contains("//"));
    }
}
