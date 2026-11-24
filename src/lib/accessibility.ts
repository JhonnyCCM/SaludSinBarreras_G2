/**
 * Estado global de Accesibilidad WCAG 2.2 (F3-Menu-accesibilidad)
 * y utilidades de Texto a Voz (TTS) + Alertas Visuales/Vibratorias.
 */

export type ContrastMode = 'standard' | 'high';
/** Interlineado: normal (1.55), medio (1.5× fuente) o amplio (2× fuente) — WCAG 1.4.12 */
export type LineHeightMode = 'normal' | 'medium' | 'large';

/**
 * Las 15 opciones del menú F3 (más el tiempo ampliado que habilita el registro por discapacidad).
 */
export interface AccessibilityState {
  /** 1.4.4 Tamaño de texto */
  fontScale: number;
  /** 1.4.6 Modo de contraste */
  contrast: ContrastMode;
  /** 1.4.12 Interlineado */
  lineHeight: LineHeightMode;
  /** 1.4.12 Espaciado de letras, palabras y párrafos */
  textSpacing: boolean;
  /** 1.4.8 Fuente legible y ancho de lectura */
  readableFont: boolean;
  /** 1.1.1 Lectura en voz alta al enfocar */
  ttsFocusAuto: boolean;
  /** 1.2.4 Subtítulos en vivo */
  subtitlesDefault: boolean;
  /** 1.2.8 Transcripción */
  showTranscript: boolean;
  /** 1.2.6 Ventana del intérprete fijada y ampliada */
  pinInterpreter: boolean;
  /** 1.3.3 Alertas visuales y vibración */
  visualAlerts: boolean;
  /** 2.1.1 / 2.1.4 Atajos de teclado Alt+Shift */
  shortcutsEnabled: boolean;
  /** 2.4.7 / 2.4.11 / 2.4.13 Foco reforzado */
  focusEnhanced: boolean;
  /** 2.5.5 Botones grandes (44 × 44 px) */
  largeTargets: boolean;
  /** 2.2.2 / 2.3.3 Detener animaciones */
  reduceMotion: boolean;
  /** 3.1.5 Lectura fácil */
  easyRead: boolean;
  /** F4 2.2.1: tiempo ampliado en formularios (motriz / cognitiva) */
  extendedTime: boolean;
}

export const DEFAULT_A11Y_STATE: AccessibilityState = {
  fontScale: 1,
  contrast: 'standard',
  lineHeight: 'normal',
  textSpacing: false,
  readableFont: false,
  ttsFocusAuto: false,
  subtitlesDefault: true,
  showTranscript: false,
  pinInterpreter: false,
  visualAlerts: true,
  shortcutsEnabled: true,
  focusEnhanced: false,
  largeTargets: false,
  reduceMotion: false,
  easyRead: false,
  extendedTime: false,
};

const STORAGE_KEY = 'ssb_a11y_prefs_v1';

function normalizeState(input: Partial<AccessibilityState> & { contrast?: string }): AccessibilityState {
  const lineHeight: LineHeightMode =
    input.lineHeight === 'medium' || input.lineHeight === 'large' ? input.lineHeight : 'normal';
  return {
    ...DEFAULT_A11Y_STATE,
    ...input,
    // Versiones anteriores guardaban 'grayscale'; el F3 solo define estándar y alto contraste.
    contrast: input.contrast === 'high' ? 'high' : 'standard',
    lineHeight,
    fontScale: clampFontScale(input.fontScale ?? 1),
  };
}

export function loadAccessibilityState(): AccessibilityState {
  if (typeof window === 'undefined') return { ...DEFAULT_A11Y_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_A11Y_STATE };
    return normalizeState(JSON.parse(raw) as Partial<AccessibilityState>);
  } catch {
    return { ...DEFAULT_A11Y_STATE };
  }
}

export function clampFontScale(scale: number): number {
  const num = Number(scale);
  if (Number.isNaN(num)) return 1;
  return Math.min(2, Math.max(1, Math.round(num * 100) / 100));
}

/** Atributos de <html> que reflejan cada opción del menú; los lee global.css. */
export function a11yRootAttributes(state: AccessibilityState): Record<string, string> {
  const flag = (v: boolean) => (v ? 'true' : 'false');
  return {
    'data-contrast': state.contrast,
    'data-focus': state.focusEnhanced ? 'enhanced' : 'standard',
    'data-line-height': state.lineHeight,
    'data-text-spacing': flag(state.textSpacing),
    'data-readable-font': flag(state.readableFont),
    'data-large-targets': flag(state.largeTargets),
    'data-reduce-motion': flag(state.reduceMotion),
    'data-easy-read': flag(state.easyRead),
    'data-subtitles-default': flag(state.subtitlesDefault),
    'data-show-transcript': flag(state.showTranscript),
    'data-pin-interpreter': flag(state.pinInterpreter),
    'data-visual-alerts': flag(state.visualAlerts),
  };
}

export function applyAccessibilityState(state: AccessibilityState): AccessibilityState {
  const normalized = normalizeState(state);

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--a11y-font-scale', String(normalized.fontScale));
    Object.entries(a11yRootAttributes(normalized)).forEach(([attr, value]) => {
      root.setAttribute(attr, value);
    });
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignorar errores de cuota de almacenamiento
    }
    window.dispatchEvent(
      new CustomEvent<AccessibilityState>('ssb:a11y-changed', { detail: normalized })
    );
  }

  return normalized;
}

export function speakText(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  const clean = text.trim();
  if (!clean) return false;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'es-EC';
    utterance.rate = 0.96;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * Divide textos largos en fragmentos por línea/oración (máximo ~260 caracteres)
 * para evitar truncados o cortes de Web Speech API en páginas extensas.
 */
export function speakLongText(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  const normalized = text.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  if (!normalized) return false;

  const chunks: string[] = [];
  for (const line of normalized.split('\n')) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;
    if (cleanLine.length <= 260) {
      chunks.push(cleanLine);
      continue;
    }
    const sentences = cleanLine.split(/(?<=[.!?])\s+/);
    let buffer = '';
    for (const sentence of sentences) {
      const part = sentence.trim();
      if (!part) continue;
      if (!buffer) {
        buffer = part;
      } else if (buffer.length + 1 + part.length <= 260) {
        buffer += ` ${part}`;
      } else {
        chunks.push(buffer);
        buffer = part;
      }
    }
    if (buffer) chunks.push(buffer);
  }

  if (chunks.length === 0) return false;

  try {
    window.speechSynthesis.cancel();
    for (const chunk of chunks) {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = 'es-EC';
      utterance.rate = 0.96;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function triggerVisualAlert(
  message: string,
  options?: { vibrate?: boolean; speak?: boolean }
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const state = loadAccessibilityState();

  if (state.visualAlerts) {
    const root = document.documentElement;
    root.classList.remove('ssb-flash-active');
    void root.offsetWidth;
    root.classList.add('ssb-flash-active');
    window.setTimeout(() => {
      root.classList.remove('ssb-flash-active');
    }, 1850);
  }

  if (options?.vibrate !== false && 'vibrate' in navigator) {
    try {
      navigator.vibrate([180, 80, 180]);
    } catch {
      // Navegador de escritorio sin hardware de vibración
    }
  }

  if (options?.speak) {
    speakText(message);
  }

  window.dispatchEvent(
    new CustomEvent<{ message: string }>('ssb:visual-alert', {
      detail: { message },
    })
  );
}
