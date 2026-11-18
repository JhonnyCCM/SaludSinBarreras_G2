//! Endpoints REST del agente. Responden con el mismo sobre que `AIHarnessResult` del frontend.

use std::time::Instant;

use axum::{extract::Path, http::StatusCode, Json};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

use crate::{guardrails, tareas};

pub const PROVEEDOR: &str = "rust-agente";

type Respuesta = Result<Json<Value>, (StatusCode, Json<Value>)>;

fn error(status: StatusCode, mensaje: impl Into<String>) -> (StatusCode, Json<Value>) {
    (status, Json(json!({ "error": mensaje.into(), "modo": "NO_CONVERSACIONAL" })))
}

fn leer<T: DeserializeOwned>(entrada: Value) -> Result<T, (StatusCode, Json<Value>)> {
    serde_json::from_value(entrada)
        .map_err(|e| error(StatusCode::UNPROCESSABLE_ENTITY, format!("Entrada inválida para la tarea: {e}")))
}

fn id_tarea(tipo: &str) -> String {
    let prefijo: String = tipo.chars().take(4).collect::<String>().to_lowercase();
    let n = chrono::Utc::now().timestamp_millis();
    format!("ssb-{prefijo}-{n:x}")
}

/// Ejecuta una tarea cerrada: guardrails de entrada → tarea → saneamiento clínico → sobre.
pub async fn ejecutar_tarea(Path(ruta): Path<String>, Json(entrada): Json<Value>) -> Respuesta {
    let inicio = Instant::now();
    guardrails::asegurar_no_conversacional(&entrada).map_err(|e| error(StatusCode::BAD_REQUEST, e))?;

    let (tipo, datos, requiere_firma) = match ruta.as_str() {
        "analizar-necesidades" => {
            let e: tareas::EntradaNecesidades = leer(entrada)?;
            tareas::validar_necesidades(&e).map_err(|m| error(StatusCode::UNPROCESSABLE_ENTITY, m))?;
            ("ANALYZE_ACCESSIBILITY_NEEDS", json!(tareas::analizar_necesidades(&e)), false)
        }
        "organizar-preguntas" => {
            let e: tareas::EntradaPreguntas = leer(entrada)?;
            tareas::validar_preguntas(&e).map_err(|m| error(StatusCode::UNPROCESSABLE_ENTITY, m))?;
            ("ORGANIZE_PATIENT_QUESTIONS", json!(tareas::organizar_preguntas(&e)), false)
        }
        "resumir-indicaciones" => {
            let e: tareas::EntradaResumen = leer(entrada)?;
            tareas::validar_resumen(&e).map_err(|m| error(StatusCode::UNPROCESSABLE_ENTITY, m))?;
            ("SUMMARIZE_MEDICAL_INDICATIONS", json!(tareas::resumir_indicaciones(&e)), true)
        }
        otra => return Err(error(StatusCode::NOT_FOUND, format!("Tarea desconocida: {otra}. El agente no acepta tareas abiertas."))),
    };

    let (datos, bloqueadas) = guardrails::sanear_valor(datos);
    Ok(Json(json!({
        "taskId": id_tarea(tipo),
        "taskType": tipo,
        "provider": PROVEEDOR,
        "nonConversationalMode": true,
        "guardrails": {
            "passed": bloqueadas.is_empty(),
            "blockedDiagnosticClaims": bloqueadas,
            "requiresProfessionalApproval": requiere_firma,
            "disclaimer": guardrails::DISCLAIMER,
        },
        "approvalState": { "status": if requiere_firma { "BORRADOR_IA_PENDIENTE" } else { "NO_REQUIERE_FIRMA" } },
        "data": datos,
        "latencyMs": inicio.elapsed().as_millis().max(1),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "metadata": { "modelUsed": "agente-rust-determinista-v1" },
    })))
}
