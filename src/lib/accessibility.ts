/**
 * Estado global de Accesibilidad WCAG 2.2 (F3-Menu-accesibilidad)
 * y utilidades de Texto a Voz (TTS) + Alertas Visuales/Vibratorias.
 */

export type ContrastMode = 'standard' | 'high' | 'grayscale';

export interface AccessibilityState {
  fontScale: number;
  contrast: ContrastMode;
  focusEnhanced: boolean;
  ttsFocusAuto: boolean;
  subtitlesDefault: boolean;
  visualAlerts: boolean;
  easyRead: boolean;
}

export const DEFAULT_A11Y_STATE: AccessibilityState = {
  fontScale: 1,
  contrast: 'standard',
  focusEnhanced: false,
  ttsFocusAuto: false,
  subtitlesDefault: true,
  visualAlerts: true,
  easyRead: false,
};

const STORAGE_KEY = 'ssb_a11y_prefs_v1';

export function loadAccessibilityState(): AccessibilityState {
  if (typeof window === 'undefined') return { ...DEFAULT_A11Y_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_A11Y_STATE };
    const parsed = JSON.parse(raw) as Partial<AccessibilityState>;
    return {
      ...DEFAULT_A11Y_STATE,
      ...parsed,
      fontScale: clampFontScale(parsed.fontScale ?? 1),
    };
  } catch {
    return { ...DEFAULT_A11Y_STATE };
  }
}

export function clampFontScale(scale: number): number {
  const num = Number(scale);
  if (Number.isNaN(num)) return 1;
  return Math.min(2, Math.max(1, Math.round(num * 100) / 100));
}

export function applyAccessibilityState(state: AccessibilityState): AccessibilityState {
  const normalized: AccessibilityState = {
    ...DEFAULT_A11Y_STATE,
    ...state,
    fontScale: clampFontScale(state.fontScale),
  };

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--a11y-font-scale', String(normalized.fontScale));
    root.setAttribute('data-contrast', normalized.contrast);
    root.setAttribute('data-focus', normalized.focusEnhanced ? 'enhanced' : 'standard');
    root.setAttribute('data-easy-read', normalized.easyRead ? 'true' : 'false');
    root.setAttribute('data-subtitles-default', normalized.subtitlesDefault ? 'true' : 'false');
    root.setAttribute('data-visual-alerts', normalized.visualAlerts ? 'true' : 'false');
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
