# SaludSinBarreras — Grupo 5

Plataforma web de telemedicina accesible para personas con discapacidad visual, auditiva, motriz, cognitiva o del habla.
Prototipo de la materia Usabilidad y Accesibilidad (ULEAM), construido a partir de los formatos F1 a F4.

**Equipo:** Elkin Delgado Licoa (líder y desarrollo) · Jork Lucas Garcia (análisis) · Jhonny Castillo Mero (pruebas y desarrollo de apoyo)

## Cómo ejecutarlo

```bash
npm install
npm run dev          # frontend en http://localhost:4321
npm run agente       # agente IA no conversacional en Rust (http://127.0.0.1:8787), en otra terminal
```

El agente Rust es opcional: si no está encendido, el frontend usa su motor local y todo sigue funcionando.
Necesita Rust 1.80 o superior (`cargo`). Pruebas del agente: `npm run agente:test`.

Otros comandos: `npm run build`, `npm run preview`, `npm run check` (tipos con `astro check`).

## Cuentas de prueba

Contraseña de todas: `salud2026`. También hay botones de un clic en `/login` y en el inicio.

| Rol | Usuario | Persona |
|---|---|---|
| Profesional (rol principal) | `MSP-130982` | Dra. Valeria Viteri, Medicina Familiar |
| Paciente | `1314567890` | María Fernanda López, discapacidad auditiva |
| Paciente | `1308745123` | Carlos Alberto Mendoza, discapacidad visual |
| Paciente | `1309988776` | Rosa Elena Zambrano, discapacidad motriz y cognitiva |
| Intérprete | `CONADIS-LSEC-0418` | Lic. Gabriela Intriago |

Los datos viven en el navegador (localStorage) y se sincronizan entre pestañas: abre al paciente en una pestaña y a la
profesional en otra para ver los avisos en vivo. Si cambió el día, aparece un aviso para actualizar los datos de ejemplo
(también en **Ayuda › Opciones de la demostración**).

## Flujo sugerido para la presentación

1. **Paciente nuevo** (`/paciente/registro`): marcar una discapacidad muestra sus apoyos y, al guardar, el menú de accesibilidad se configura solo.
2. **Profesional** (`/profesional`): confirmar citas, ver la ficha de apoyos, solicitar intérprete.
3. **Intérprete** (`/interprete`): aceptar la solicitud y preparar la sesión con el glosario.
4. **Videoconsulta** (`/profesional/consulta`, `/paciente/sala`, `/interprete/sesion`): con el agente Rust encendido, cada frase se convierte en subtítulo, glosas de señas y texto para lector de pantalla en todas las pestañas de la sala.
5. **Cierre clínico**: resumen IA → firma → receta (genera recordatorios) → historia clínica → seguimiento.

## Estructura

```
src/
  components/      AccessibilityMenu (F3), SessionTimeout (F4 2.2.1), VideoRoom (sala compartida)
  layouts/         BaseLayout: navegación por rol, ayuda fija, regiones vivas
  lib/
    accessibility.ts, shortcuts.ts    opciones del menú y atajos Alt+Shift
    forms.ts, review.ts, autosave.ts  validación, revisión antes de enviar y borradores (F4)
    supports.ts                       discapacidad → apoyos → opciones del menú (tabla del F4)
    data/                             citas, profesionales, intérpretes, consulta, tratamiento, historia
    ai-harness/                       harness no conversacional (proveedor por defecto: agente Rust)
    realtime.ts                       canal de la videoconsulta (WebSocket del agente o modo local)
  pages/
    paciente/  profesional/  interprete/  login, ayuda, trazabilidad, ia-harness
backend/agente-ia/                    agente en Rust (Axum): tareas cerradas, glosas LSEc, lector, WebSocket
```

## Trazabilidad

La página `/trazabilidad` relaciona cada requisito del F2 (RF-01 a RF-24) con su pantalla, las 15 opciones del menú del
F3 con su criterio WCAG y los criterios del F4 con su implementación.

## Límites del prototipo

- Las glosas de Lengua de Señas Ecuatoriana se generan por reglas: son un apoyo visual y no reemplazan al intérprete acreditado.
- El video entre participantes es simulado (cada pestaña ve su propia cámara); el canal en tiempo real sí comparte subtítulos, señas, turnos y presencia.
- No hay servidor de datos ni autenticación real: es un prototipo para validar usabilidad y accesibilidad.
