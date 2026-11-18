//! Agente de IA no conversacional de SaludSinBarreras.
//!
//! Servicio HTTP + WebSocket que ejecuta solo tareas cerradas (nunca chat abierto):
//! - Tareas del harness: analizar necesidades, organizar preguntas y resumir indicaciones.
//! - Glosas de Lengua de Señas Ecuatoriana (LSEc) a partir de texto.
//! - Segmentos para lector de pantalla / lectura en voz alta.
//! - Canal en tiempo real por sala de videoconsulta.

mod api;
mod guardrails;
mod senas;
mod tareas;

use std::net::SocketAddr;

use axum::{
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};

async fn salud() -> Json<Value> {
    Json(json!({
        "servicio": "agente-ia",
        "version": env!("CARGO_PKG_VERSION"),
        "modo": "NO_CONVERSACIONAL",
        "estado": "ok"
    }))
}

pub fn app() -> Router {
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);
    Router::new()
        .route("/salud", get(salud))
        .route("/v1/tareas/{tarea}", post(api::ejecutar_tarea))
        .layer(cors)
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8787);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await.expect("no se pudo abrir el puerto");
    println!("Agente IA no conversacional escuchando en http://{addr}");
    axum::serve(listener, app())
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("error del servidor");
}
