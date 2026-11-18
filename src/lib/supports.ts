/**
 * Registro de usuarios por discapacidad (F4 · tabla "Apoyos que se habilitan").
 * Cada tipo de discapacidad habilita automáticamente sus apoyos; cada apoyo activa una opción del menú F3.
 * RF-01: el paciente puede activar o desactivar cada apoyo antes de crear la cuenta.
 */
import type { AccessibilityState } from './accessibility';
import type { CommunicationPreferences, DisabilityCategory } from './ai-harness/types';

export type SupportKey =
  | 'tts'
  | 'fontLarge'
  | 'highContrast'
  | 'focusEnhanced'
  | 'subtitles'
  | 'transcript'
  | 'interpreter'
  | 'visualAlerts'
  | 'shortcuts'
  | 'largeTargets'
  | 'extendedTime'
  | 'easyRead'
  | 'lineHeight'
  | 'textSpacing'
  | 'readableFont'
  | 'reduceMotion'
  | 'textQuestions'
  | 'raiseHand';

export interface SupportDef {
  label: string;
  desc: string;
  /** Opción del menú F3 que activa (null si es una función de la plataforma) */
  menu: string | null;
}

export const SUPPORTS: Record<SupportKey, SupportDef> = {
  tts: { label: 'Lectura en voz alta', desc: 'Lee páginas, formularios y confirmaciones.', menu: 'Leer el campo al enfocarlo' },
  fontLarge: { label: 'Texto ampliado (150 %)', desc: 'Letra más grande en toda la plataforma.', menu: 'Tamaño de texto' },
  highContrast: { label: 'Alto contraste', desc: 'Fondo negro con texto amarillo o blanco.', menu: 'Modo de contraste' },
  focusEnhanced: { label: 'Foco reforzado', desc: 'Borde grueso en el control activo.', menu: 'Foco reforzado' },
  subtitles: { label: 'Subtítulos en vivo', desc: 'En cada videoconsulta.', menu: 'Subtítulos en vivo' },
  transcript: { label: 'Transcripción', desc: 'Texto completo de la consulta.', menu: 'Transcripción' },
  interpreter: { label: 'Intérprete de Lengua de Señas Ecuatoriana', desc: 'Se solicita para tus citas y su ventana queda fija.', menu: 'Ventana del intérprete' },
  visualAlerts: { label: 'Avisos visuales con vibración', desc: 'Llamadas y recordatorios sin depender del sonido.', menu: 'Alertas visuales y vibración' },
  shortcuts: { label: 'Navegación por teclado con atajos', desc: 'Atajos Alt+Shift para todo.', menu: 'Atajos de teclado' },
  largeTargets: { label: 'Botones grandes', desc: 'Controles de 44 × 44 px o más.', menu: 'Botones grandes' },
  extendedTime: { label: 'Tiempo ampliado en formularios', desc: 'La sesión dura el doble antes de avisar.', menu: null },
  easyRead: { label: 'Lectura fácil con pictogramas', desc: 'Indicaciones en frases cortas.', menu: 'Lectura fácil' },
  lineHeight: { label: 'Interlineado amplio', desc: 'Más espacio entre líneas.', menu: 'Interlineado' },
  textSpacing: { label: 'Espaciado de texto', desc: 'Más espacio entre letras y palabras.', menu: 'Espaciado de texto' },
  readableFont: { label: 'Fuente legible', desc: 'Fuente sin serifa y líneas cortas.', menu: 'Fuente legible' },
  reduceMotion: { label: 'Animaciones detenidas', desc: 'Sin movimiento ni destellos.', menu: 'Detener animaciones' },
  textQuestions: { label: 'Preguntas por texto o en señas', desc: 'En lugar de hablar en la consulta.', menu: null },
  raiseHand: { label: 'Botón para pedir la palabra', desc: 'También con Alt+Shift+P.', menu: null },
};

/** Tabla del F4: tipo de discapacidad → apoyos que se habilitan automáticamente. */
export const DISABILITY_SUPPORTS: Record<DisabilityCategory, SupportKey[]> = {
  visual: ['tts', 'fontLarge', 'highContrast', 'focusEnhanced'],
  auditiva: ['subtitles', 'transcript', 'interpreter', 'visualAlerts'],
  motriz: ['shortcuts', 'largeTargets', 'focusEnhanced', 'extendedTime'],
  cognitiva: ['easyRead', 'lineHeight', 'textSpacing', 'readableFont', 'reduceMotion', 'extendedTime'],
  habla: ['textQuestions', 'raiseHand', 'shortcuts'],
};

export function supportsFor(disabilities: DisabilityCategory[]): SupportKey[] {
  return [...new Set(disabilities.flatMap((d) => DISABILITY_SUPPORTS[d]))];
}

/** Opciones del menú F3 que se encienden con los apoyos elegidos. */
export function a11yPatchFromSupports(supports: SupportKey[]): Partial<AccessibilityState> {
  const has = (k: SupportKey) => supports.includes(k);
  return {
    ttsFocusAuto: has('tts'),
    fontScale: has('fontLarge') ? 1.5 : 1,
    contrast: has('highContrast') ? 'high' : 'standard',
    focusEnhanced: has('focusEnhanced'),
    subtitlesDefault: has('subtitles') || !supports.length,
    showTranscript: has('transcript'),
    pinInterpreter: has('interpreter'),
    visualAlerts: has('visualAlerts') || !supports.length,
    shortcutsEnabled: true,
    largeTargets: has('largeTargets'),
    extendedTime: has('extendedTime'),
    easyRead: has('easyRead'),
    lineHeight: has('lineHeight') ? 'medium' : 'normal',
    textSpacing: has('textSpacing'),
    readableFont: has('readableFont'),
    reduceMotion: has('reduceMotion'),
  };
}

/** Preferencias que entiende el harness de IA a partir de los apoyos. */
export function preferencesFromSupports(
  supports: SupportKey[],
  reminders: { visual: boolean; vibration: boolean; audio: boolean }
): CommunicationPreferences {
  const has = (k: SupportKey) => supports.includes(k);
  return {
    subtitles: has('subtitles'),
    lsecInterpreter: has('interpreter'),
    ttsAudio: has('tts'),
    easyReadPictograms: has('easyRead'),
    highContrast: has('highContrast'),
    fontScale: has('fontLarge') ? 1.5 : 1,
    remindersVisual: reminders.visual,
    remindersVibration: reminders.vibration,
    remindersAudio: reminders.audio,
  };
}
