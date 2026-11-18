//! Tareas cerradas del agente (mismo contrato JSON que `src/lib/ai-harness/types.ts`).
//!
//! - ANALYZE_ACCESSIBILITY_NEEDS: ficha de apoyos para el profesional (RF-10).
//! - ORGANIZE_PATIENT_QUESTIONS: preguntas del paciente ordenadas por prioridad (RF-04 / RF-13).
//! - SUMMARIZE_MEDICAL_INDICATIONS: borrador en lectura fácil pendiente de firma (RF-14).

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

fn re(p: &str) -> Regex {
    Regex::new(p).expect("regex válida")
}

// ---------------------------------------------------------------------------
// Tipos compartidos
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferencias {
    pub subtitles: bool,
    pub lsec_interpreter: bool,
    pub tts_audio: bool,
    pub easy_read_pictograms: bool,
    pub high_contrast: bool,
    pub font_scale: f64,
    pub reminders_visual: bool,
    pub reminders_vibration: bool,
    pub reminders_audio: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaNecesidades {
    pub patient_name: String,
    pub age: u32,
    pub disabilities: Vec<String>,
    /// Parte del contrato del frontend; el motor determinista no lo necesita.
    #[serde(default)]
    #[allow(dead_code)]
    pub disability_details: String,
    #[serde(default)]
    pub assistive_tech: Vec<String>,
    pub communication_preferences: Preferencias,
    pub connectivity: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetInterfaz {
    pub font_scale: f64,
    pub contrast: &'static str,
    pub tts_auto: bool,
    pub easy_read: bool,
    pub subtitles_default: bool,
    pub visual_alerts: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SalidaNecesidades {
    pub summary_banner: String,
    pub requires_extra_session_time: bool,
    pub recommended_extra_minutes: u32,
    pub mandatory_supports: Vec<String>,
    pub professional_checklist: Vec<String>,
    pub interpreter_briefing: Vec<String>,
    pub bandwidth_recommendation: String,
    pub applied_interface_preset: PresetInterfaz,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaPreguntas {
    pub patient_name: String,
    pub specialty: String,
    #[serde(default)]
    pub consultation_reason: String,
    pub raw_notes_and_doubts: String,
    pub preferred_input_mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Pregunta {
    pub priority: &'static str,
    pub category: &'static str,
    pub question: String,
    pub easy_read_hint: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SalidaPreguntas {
    pub chief_focus: String,
    pub prioritized_questions: Vec<Pregunta>,
    pub suggested_clarifications_for_doctor: Vec<String>,
    pub tts_script: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatoObjetivo {
    pub easy_read: bool,
    pub include_audio_script: bool,
    /// Los pictogramas siempre se incluyen; se acepta el campo por compatibilidad.
    #[serde(default)]
    #[allow(dead_code)]
    pub include_pictograms: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaResumen {
    pub doctor_name: String,
    pub patient_name: String,
    pub consultation_date: String,
    #[serde(default)]
    pub clinical_notes: String,
    #[serde(default)]
    pub transcript_text: String,
    pub target_format: FormatoObjetivo,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Medicamento {
    pub name: String,
    pub dosage: String,
    pub schedule: String,
    pub duration: String,
    pub pictogram: &'static str,
    pub plain_instruction: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SalidaResumen {
    pub easy_read_summary: String,
    pub medications: Vec<Medicamento>,
    pub care_steps: Vec<String>,
    pub warning_signs: Vec<String>,
    pub next_follow_up: String,
    pub tts_audio_script: String,
    pub accessible_transcript_txt: String,
}

// ---------------------------------------------------------------------------
// Validación mínima por tarea
// ---------------------------------------------------------------------------

pub fn validar_necesidades(e: &EntradaNecesidades) -> Result<(), String> {
    if e.patient_name.trim().is_empty() {
        return Err("Falta patientName para ANALYZE_ACCESSIBILITY_NEEDS.".into());
    }
    if e.disabilities.is_empty() {
        return Err("Debe indicarse al menos una categoría en disabilities.".into());
    }
    Ok(())
}

pub fn validar_preguntas(e: &EntradaPreguntas) -> Result<(), String> {
    if e.raw_notes_and_doubts.trim().is_empty() {
        return Err("Debe ingresar notas o dudas del paciente para organizarlas.".into());
    }
    Ok(())
}

pub fn validar_resumen(e: &EntradaResumen) -> Result<(), String> {
    if e.doctor_name.trim().is_empty() || e.patient_name.trim().is_empty() {
        return Err("Se requiere doctorName y patientName para resumir indicaciones.".into());
    }
    if e.clinical_notes.trim().is_empty() && e.transcript_text.trim().is_empty() {
        return Err("Debe proporcionar notas clínicas o transcripción para generar el borrador.".into());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// ANALYZE_ACCESSIBILITY_NEEDS
// ---------------------------------------------------------------------------

pub fn analizar_necesidades(e: &EntradaNecesidades) -> SalidaNecesidades {
    let tiene = |d: &str| e.disabilities.iter().any(|x| x == d);
    let p = &e.communication_preferences;
    let (auditiva, visual, motriz, cognitiva, habla) =
        (tiene("auditiva"), tiene("visual"), tiene("motriz"), tiene("cognitiva"), tiene("habla"));

    let necesita_lsec = auditiva || p.lsec_interpreter;
    let necesita_subtitulos = auditiva || p.subtitles;
    let necesita_tts = visual || p.tts_audio;
    let necesita_lectura_facil = cognitiva || p.easy_read_pictograms;

    let mut apoyos: Vec<String> = Vec::new();
    let mut checklist: Vec<String> = Vec::new();
    let mut briefing: Vec<String> = Vec::new();
    let agregar = |v: &mut Vec<String>, s: String| {
        if !v.contains(&s) {
            v.push(s)
        }
    };

    if necesita_subtitulos {
        agregar(&mut apoyos, "Subtítulos automáticos en tiempo real activos al entrar a sala (RF-03).".into());
    }
    if necesita_lsec {
        agregar(&mut apoyos, "Intérprete de Lengua de Señas Ecuatoriana (LSEc) en ventana fija y prioritaria (F3 · WCAG 1.2.6).".into());
        agregar(&mut checklist, "Hablar de frente a la cámara, ritmo pausado y respetando turnos con el intérprete.".into());
        briefing.push(format!("Paciente {} requiere interpretación LSEc continua.", e.patient_name));
        briefing.push("Mantener cámara con iluminación frontal, fondo liso y manos visibles en todo momento.".into());
        let tec = if e.assistive_tech.is_empty() { "Lengua de Señas Ecuatoriana (LSEc)".to_string() } else { e.assistive_tech.join(", ") };
        briefing.push(format!("Tecnologías reportadas: {tec}."));
    } else {
        briefing.push("No requiere intérprete LSEc para esta ficha; mantener canal de respaldo disponible.".into());
    }
    if visual {
        agregar(&mut apoyos, "Lectura por voz compatible con lector de pantalla y alto contraste.".into());
        agregar(&mut checklist, "Describir verbalmente cualquier indicación visual, dosis o documento compartido.".into());
    }
    if motriz {
        agregar(&mut apoyos, "Interfaz operable por teclado o pulsadores con atajos Alt+Shift y botones grandes.".into());
        agregar(&mut checklist, "Evitar límites de tiempo estrictos y permitir confirmaciones paso a paso.".into());
    }
    if necesita_lectura_facil {
        agregar(&mut apoyos, "Resumen de indicaciones en lectura fácil con listas cortas y pictogramas (RF-05).".into());
        agregar(&mut checklist, "Usar lenguaje cotidiano sin jerga médica y confirmar comprensión al cierre.".into());
    }
    if habla {
        agregar(&mut apoyos, "Preguntas por texto o señas y botón para pedir la palabra sin exigir voz.".into());
        agregar(&mut checklist, "Dar tiempo suficiente para que el paciente escriba o use su comunicador alternativo.".into());
    }
    let canales: Vec<&str> = [
        (p.reminders_visual, "visual"),
        (p.reminders_vibration, "vibración"),
        (p.reminders_audio, "sonoro"),
    ]
    .iter()
    .filter(|(on, _)| *on)
    .map(|(_, n)| *n)
    .collect();
    if !canales.is_empty() {
        agregar(&mut apoyos, format!("Recordatorios multimodales habilitados ({}) (RF-06).", canales.join(" + ")));
    }
    agregar(&mut checklist, "Verificar que el borrador de indicaciones IA sea revisado y firmado antes de enviarlo (RF-14).".into());

    let extra = if necesita_lsec { 15 } else if cognitiva || habla { 10 } else { 0 };
    let ancho = match e.connectivity.as_str() {
        "baja" => "Conectividad baja: activar ahorro de ancho de banda manteniendo prioridad en subtítulos y audio.",
        "media" => "Conectividad media: video estándar adaptativo y respaldo de subtítulos sincrónicos.",
        _ => "Conectividad alta: calidad HD para video de consulta e intérprete LSEc.",
    };
    let escala = if p.font_scale > 0.0 { p.font_scale } else if visual { 1.5 } else { 1.0 };

    SalidaNecesidades {
        summary_banner: format!(
            "{} ({} años) — Discapacidad: {}. {}",
            e.patient_name,
            e.age,
            e.disabilities.join(", ").to_uppercase(),
            if extra > 0 { format!("Reservar +{extra} min adicionales en agenda.") } else { "Duración estándar de consulta con apoyos activos.".into() }
        ),
        requires_extra_session_time: extra > 0,
        recommended_extra_minutes: extra,
        mandatory_supports: apoyos,
        professional_checklist: checklist,
        interpreter_briefing: briefing,
        bandwidth_recommendation: ancho.into(),
        applied_interface_preset: PresetInterfaz {
            font_scale: escala.clamp(1.0, 2.0),
            contrast: if p.high_contrast { "high" } else { "standard" },
            tts_auto: necesita_tts,
            easy_read: necesita_lectura_facil,
            subtitles_default: necesita_subtitulos,
            visual_alerts: p.reminders_visual || auditiva,
        },
    }
}

// ---------------------------------------------------------------------------
// ORGANIZE_PATIENT_QUESTIONS
// ---------------------------------------------------------------------------

static SEPARADOR_PREGUNTAS: LazyLock<Regex> = LazyLock::new(|| re(r"[\n.;?¿]+"));
static R_MEDICACION: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)pastilla|medic|dosis|jarabe|tomar|tomo|remedio|receta"));
static R_EXAMENES: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)examen|an[aá]lisis|sangre|resultado|rayos|eco"));
static R_CUIDADOS: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)comer|agua|ejercicio|reposo|dormir|cuidado|trabaj"));
static R_URGENTE: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)dolor|fiebre|mareo|falta de aire|presi[oó]n|urgente"));

pub fn organizar_preguntas(e: &EntradaPreguntas) -> SalidaPreguntas {
    let fragmentos: Vec<&str> = SEPARADOR_PREGUNTAS
        .split(&e.raw_notes_and_doubts)
        .map(str::trim)
        .filter(|s| s.chars().count() > 3)
        .take(8)
        .collect();

    let mut preguntas: Vec<Pregunta> = fragmentos
        .iter()
        .enumerate()
        .map(|(i, frag)| {
            let (mut categoria, mut prioridad) = ("sintomas", if i == 0 { "alta" } else { "media" });
            if R_MEDICACION.is_match(frag) {
                categoria = "medicacion";
                prioridad = "alta";
            } else if R_EXAMENES.is_match(frag) {
                categoria = "examenes";
            } else if R_CUIDADOS.is_match(frag) {
                categoria = "cuidados";
                prioridad = "baja";
            }
            if R_URGENTE.is_match(frag) {
                prioridad = "alta";
            }
            let mut c = frag.chars();
            let capital = c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default();
            Pregunta {
                priority: prioridad,
                category: categoria,
                question: format!("¿{capital}?"),
                easy_read_hint: format!("Punto {} ({categoria}): pregúntalo con calma durante la consulta.", i + 1),
            }
        })
        .collect();

    // Alta primero, luego media y baja; se conserva el orden original dentro de cada nivel.
    preguntas.sort_by_key(|p| match p.priority { "alta" => 0, "media" => 1, _ => 2 });

    if preguntas.is_empty() {
        let motivo = if e.consultation_reason.is_empty() { "mi motivo de consulta" } else { &e.consultation_reason };
        preguntas.push(Pregunta {
            priority: "alta",
            category: "sintomas",
            question: format!("¿Qué debo vigilar respecto a: {motivo}?"),
            easy_read_hint: "Pregunta principal para iniciar la consulta.".into(),
        });
    }

    let tts = format!(
        "Preguntas organizadas para {} en {}. {}",
        e.patient_name,
        e.specialty,
        preguntas
            .iter()
            .enumerate()
            .map(|(i, q)| format!("Pregunta {}, prioridad {}: {}", i + 1, q.priority, q.question))
            .collect::<Vec<_>>()
            .join(" ")
    );

    SalidaPreguntas {
        chief_focus: format!(
            "Consulta de {} — Motivo: {} (modalidad: {}).",
            e.specialty,
            if e.consultation_reason.is_empty() { "seguimiento general" } else { &e.consultation_reason },
            e.preferred_input_mode
        ),
        prioritized_questions: preguntas,
        suggested_clarifications_for_doctor: vec![
            format!("Confirmar desde cuándo presenta las molestias descritas por {}.", e.patient_name),
            "Validar si está tomando medicación previa o suplementos.".into(),
            "Confirmar comprensión de los pasos siguientes usando el canal preferido del paciente.".into(),
        ],
        tts_script: tts,
    }
}

// ---------------------------------------------------------------------------
// SUMMARIZE_MEDICAL_INDICATIONS
// ---------------------------------------------------------------------------

static SEPARADOR_LINEAS: LazyLock<Regex> = LazyLock::new(|| re(r"[\n;]+|\.\s"));
static R_CONTROL: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)control|pr[oó]xima cita|regresar|revisi[oó]n en|nos vemos en"));
static R_CADA_HORAS: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)cada \d+ horas"));
static R_ALARMA: LazyLock<Regex> = LazyLock::new(|| {
    re(r"(?i)alarma|urgencia|emergencia|si presenta|acudir de inmediato|fiebre alta|dificultad para respirar")
});
static R_DOSIS: LazyLock<Regex> = LazyLock::new(|| {
    re(r"(?i)\d+([.,]\d+)?\s*(mg|ml|gotas?|puff|ui|tabletas?|c[aá]psulas?|comprimidos?)")
});
static R_VERBO_MED: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)\b(tomar|aplicar|inhalar)\b"));
static R_HORARIO: LazyLock<Regex> = LazyLock::new(|| {
    re(r"(?i)cada\s+\d+\s*(horas|h|d[ií]as)|en la (mañana|noche)|desayuno|almuerzo|cena")
});
static R_DURACION: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)por\s+\d+\s*(d[ií]as|semanas|meses)"));

fn pictograma(linea: &str) -> &'static str {
    let l = linea.to_lowercase();
    let tiene = |p: &str| re(p).is_match(&l);
    if tiene(r"jarabe|ml|cucharada|suspensi[oó]n") {
        "jarabe"
    } else if tiene(r"gotas|colirio|oft[aá]lmic|[oó]tic") {
        "gotas"
    } else if tiene(r"inhalador|puff|spray|nebuliz") {
        "inhalador"
    } else if tiene(r"inyec|ampolla|insulina|subcut[aá]ne") {
        "inyeccion"
    } else if tiene(r"alerta|urgencia|fiebre|emergencia") {
        "alerta"
    } else if tiene(r"reposo|agua|dieta|control|medir|caminar|ejercicio") {
        "cuidado"
    } else {
        "pastilla"
    }
}

pub fn resumir_indicaciones(e: &EntradaResumen) -> SalidaResumen {
    let fuente = format!("{}\n{}", e.clinical_notes, e.transcript_text);
    let lineas: Vec<String> = SEPARADOR_LINEAS
        .split(fuente.trim())
        .map(|l| l.trim().trim_end_matches('.').to_string())
        .filter(|l| l.chars().count() > 3)
        .collect();

    let mut meds = Vec::new();
    let mut cuidados = Vec::new();
    let mut alarmas = Vec::new();
    let mut control: Option<String> = None;

    for linea in &lineas {
        if control.is_none() && R_CONTROL.is_match(linea) && !R_CADA_HORAS.is_match(linea) {
            control = Some(linea.clone());
        }
        if R_ALARMA.is_match(linea) {
            alarmas.push(linea.clone());
            continue;
        }
        if R_DOSIS.is_match(linea) || R_CADA_HORAS.is_match(linea) || R_VERBO_MED.is_match(linea) {
            let nombre: String = linea.split([',', ':', '-']).next().unwrap_or("").trim().chars().take(60).collect();
            meds.push(Medicamento {
                name: if nombre.is_empty() { "Indicación registrada por el médico".into() } else { nombre },
                dosage: R_DOSIS.find(linea).map(|m| m.as_str().to_string()).unwrap_or_else(|| "Según indicación escrita del profesional".into()),
                schedule: R_HORARIO.find(linea).map(|m| m.as_str().to_string()).unwrap_or_else(|| "Según horario definido en consulta".into()),
                duration: R_DURACION.find(linea).map(|m| m.as_str().to_string()).unwrap_or_else(|| "Hasta el próximo control".into()),
                pictogram: pictograma(linea),
                plain_instruction: linea.clone(),
            });
            continue;
        }
        cuidados.push(linea.clone());
    }

    if meds.is_empty() {
        cuidados.insert(0, "No se detectaron medicamentos en las notas; siga las indicaciones generales de su médico.".into());
    }
    if alarmas.is_empty() {
        alarmas.push("Fiebre mayor a 38,5 °C, dificultad para respirar o empeoramiento súbito: acuda a urgencias.".into());
    }
    cuidados.truncate(6);
    if cuidados.is_empty() {
        cuidados.push("Mantenga una hidratación adecuada y reposo según tolerancia.".into());
    }
    let control = control.unwrap_or_else(|| "Control de seguimiento según la fecha acordada con el profesional.".into());

    let resumen = if e.target_format.easy_read {
        format!(
            "Hola, {}. {} revisó su consulta del {}. Siga paso a paso las indicaciones de abajo. Este resumen no reemplaza una emergencia médica.",
            e.patient_name, e.doctor_name, e.consultation_date
        )
    } else {
        format!("Resumen de la atención de {} el {} para {}.", e.doctor_name, e.consultation_date, e.patient_name)
    };

    let guion = if e.target_format.include_audio_script {
        let m = meds
            .iter()
            .enumerate()
            .map(|(i, m)| format!("Número {}: {}.", i + 1, m.plain_instruction))
            .collect::<Vec<_>>()
            .join(" ");
        format!(
            "{resumen} {} Cuidados diarios: {}. Señales de alarma: {}. Próximo paso: {control}.",
            if m.is_empty() { String::new() } else { format!("Medicación: {m}") },
            cuidados.join(". "),
            alarmas.join(". ")
        )
    } else {
        String::new()
    };

    let transcripcion = [
        "SALUDSINBARRERAS — TRANSCRIPCIÓN ACCESIBLE DE TELECONSULTA (RF-07)".to_string(),
        format!("Fecha: {}", e.consultation_date),
        format!("Paciente: {}", e.patient_name),
        format!("Profesional de salud: {}", e.doctor_name),
        "------------------------------------------------------------".into(),
        "NOTAS CLÍNICAS:".into(),
        if e.clinical_notes.is_empty() { "(Sin notas)".into() } else { e.clinical_notes.clone() },
        String::new(),
        "TRANSCRIPCIÓN:".into(),
        if e.transcript_text.is_empty() { "(Sin transcripción)".into() } else { e.transcript_text.clone() },
        "------------------------------------------------------------".into(),
        "Documento generado con apoyo de IA no conversacional; válido solo tras la firma del profesional.".into(),
    ]
    .join("\n");

    SalidaResumen {
        easy_read_summary: resumen,
        medications: meds,
        care_steps: cuidados,
        warning_signs: alarmas,
        next_follow_up: control,
        tts_audio_script: guion,
        accessible_transcript_txt: transcripcion,
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    fn prefs() -> Preferencias {
        Preferencias {
            subtitles: false,
            lsec_interpreter: false,
            tts_audio: false,
            easy_read_pictograms: false,
            high_contrast: false,
            font_scale: 1.0,
            reminders_visual: true,
            reminders_vibration: false,
            reminders_audio: false,
        }
    }

    #[test]
    fn auditiva_reserva_15_minutos_e_interprete() {
        let s = analizar_necesidades(&EntradaNecesidades {
            patient_name: "María".into(),
            age: 34,
            disabilities: vec!["auditiva".into()],
            disability_details: String::new(),
            assistive_tech: vec![],
            communication_preferences: prefs(),
            connectivity: "media".into(),
        });
        assert_eq!(s.recommended_extra_minutes, 15);
        assert!(s.mandatory_supports.iter().any(|a| a.contains("Intérprete")));
        assert!(s.applied_interface_preset.subtitles_default);
    }

    #[test]
    fn preguntas_de_medicacion_van_primero() {
        let s = organizar_preguntas(&EntradaPreguntas {
            patient_name: "Rosa".into(),
            specialty: "Medicina Familiar".into(),
            consultation_reason: String::new(),
            raw_notes_and_doubts: "cuánta agua debo tomar al día. la pastilla la tomo antes del desayuno".into(),
            preferred_input_mode: "texto".into(),
        });
        assert_eq!(s.prioritized_questions[0].category, "medicacion");
        assert!(s.prioritized_questions[0].question.starts_with('¿'));
    }

    #[test]
    fn resumen_extrae_medicamentos_alarmas_y_control() {
        let s = resumir_indicaciones(&EntradaResumen {
            doctor_name: "Dra. Viteri".into(),
            patient_name: "Carlos".into(),
            consultation_date: "2026-11-19".into(),
            clinical_notes: "Losartan 50 mg: tomar 1 tableta cada 24 horas por 30 días.\nSi presenta dolor ocular intenso acudir a urgencias.\nControl en 15 días.".into(),
            transcript_text: String::new(),
            target_format: FormatoObjetivo { easy_read: true, include_audio_script: true, include_pictograms: true },
        });
        assert_eq!(s.medications.len(), 1);
        assert_eq!(s.medications[0].dosage, "50 mg");
        assert_eq!(s.medications[0].duration, "por 30 días");
        assert_eq!(s.warning_signs.len(), 1);
        assert!(s.next_follow_up.contains("15 días"));
    }
}
