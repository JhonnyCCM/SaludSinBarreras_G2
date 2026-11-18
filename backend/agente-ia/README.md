# Agente IA no conversacional (Rust)

Servicio en Rust (Axum + Tokio) que ejecuta **solo tareas cerradas** para SaludSinBarreras. No existe un endpoint de chat: cualquier entrada con forma de conversación se rechaza.

## Ejecutar

```bash
# desde la raíz del repositorio
npm run agente          # equivale a: cargo run --manifest-path backend/agente-ia/Cargo.toml
# o con otro puerto
PORT=9000 npm run agente
```

Por defecto escucha en `http://127.0.0.1:8787`. El frontend lo detecta con `PUBLIC_AGENTE_URL` (ver `.env.example`).
Si el agente no está encendido, el frontend usa su motor local en TypeScript y la demo sigue funcionando.

## Pruebas

```bash
cargo test --manifest-path backend/agente-ia/Cargo.toml
```

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| GET | `/salud` | Estado del servicio |
| POST | `/v1/tareas/analizar-necesidades` | Ficha de apoyos del paciente (RF-10) |
| POST | `/v1/tareas/organizar-preguntas` | Preguntas del paciente ordenadas (RF-04, RF-13) |
| POST | `/v1/tareas/resumir-indicaciones` | Borrador en lectura fácil, pendiente de firma (RF-14) |
| POST | `/v1/senas` | `{ texto }` → glosas de Lengua de Señas Ecuatoriana |
| POST | `/v1/lector` | `{ texto, hablante? }` → segmentos para lector de pantalla |
| GET (WebSocket) | `/v1/tiempo-real?sala=<id de cita>` | Canal en tiempo real de la videoconsulta |

Las tareas devuelven el mismo sobre que `AIHarnessResult` en `src/lib/ai-harness/types.ts`.

### Canal en tiempo real

Mensajes que acepta (JSON con `tipo`):

```json
{ "tipo": "transcripcion", "hablante": "Dra. Viteri", "texto": "Tome la pastilla por la mañana." }
{ "tipo": "turno", "quien": "María", "accion": "pedir" }
{ "tipo": "presencia", "rol": "interprete", "nombre": "Lic. Gabriela Intriago", "estado": "conectado" }
{ "tipo": "ping" }
```

Cada `transcripcion` se difunde a toda la sala con el subtítulo, las glosas y los segmentos del lector:

```json
{
  "tipo": "transcripcion",
  "hablante": "Dra. Viteri",
  "texto": "Tome la pastilla por la mañana.",
  "senas": { "textoGlosado": "MAÑANA TOMAR PASTILLA", "cobertura": 1.0, "oraciones": [...] },
  "lector": [{ "texto": "doctora Viteri: Tome la pastilla por la mañana.", "prioridad": "cortes" }]
}
```

## Módulos

- `guardrails.rs`: bloqueo de chat, de inyección de instrucciones y de frases de diagnóstico o receta autónoma.
- `tareas.rs`: las tres tareas cerradas del harness.
- `senas.rs`: glosador LSEc por reglas (léxico médico, tiempo al inicio, interrogativo y negación al final, dactilología).
- `lector.rs`: expansión de abreviaturas médicas, segmentación y prioridad urgente para alarmas.
- `tiempo_real.rs`: WebSocket por sala y endpoints REST de apoyo.

## Límites

Las glosas son un **apoyo visual generado por reglas**: no son una traducción completa a LSEc ni reemplazan al intérprete acreditado, que es quien interpreta la consulta.
