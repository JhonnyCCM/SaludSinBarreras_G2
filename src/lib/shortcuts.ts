/**
 * Atajos de teclado del menú de accesibilidad (F3 · WCAG 2.1.1 y 2.1.4).
 * Todos usan Alt+Shift para no activarse al escribir; el usuario puede reasignarlos o desactivarlos.
 * Se guardan como KeyboardEvent.code para que funcionen igual en teclados español e inglés.
 */

export type ShortcutAction =
  | 'menu'
  | 'textUp'
  | 'textDown'
  | 'contrast'
  | 'read'
  | 'reset'
  | 'help'
  | 'subtitles'
  | 'transcript'
  | 'interpreter'
  | 'mic'
  | 'camera'
  | 'raiseHand';

export interface ShortcutDef {
  action: ShortcutAction;
  code: string;
  label: string;
  scope: 'Todas las pantallas' | 'Videoconsulta';
  editable: boolean;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  { action: 'menu', code: 'KeyA', label: 'Abrir o cerrar el menú de accesibilidad', scope: 'Todas las pantallas', editable: true },
  { action: 'textUp', code: 'ArrowUp', label: 'Aumentar el tamaño del texto', scope: 'Todas las pantallas', editable: false },
  { action: 'textDown', code: 'ArrowDown', label: 'Reducir el tamaño del texto', scope: 'Todas las pantallas', editable: false },
  { action: 'contrast', code: 'KeyC', label: 'Cambiar el modo de contraste', scope: 'Todas las pantallas', editable: true },
  { action: 'read', code: 'KeyL', label: 'Leer en voz alta la selección o el campo enfocado (Esc detiene)', scope: 'Todas las pantallas', editable: true },
  { action: 'reset', code: 'Digit0', label: 'Restablecer todos los ajustes del menú', scope: 'Todas las pantallas', editable: true },
  { action: 'help', code: 'KeyK', label: 'Mostrar la lista de atajos de teclado', scope: 'Todas las pantallas', editable: true },
  { action: 'subtitles', code: 'KeyS', label: 'Activar o desactivar los subtítulos', scope: 'Videoconsulta', editable: true },
  { action: 'transcript', code: 'KeyT', label: 'Mostrar u ocultar la transcripción', scope: 'Videoconsulta', editable: true },
  { action: 'interpreter', code: 'KeyI', label: 'Fijar o agrandar la ventana del intérprete', scope: 'Videoconsulta', editable: true },
  { action: 'mic', code: 'KeyM', label: 'Activar o silenciar el micrófono', scope: 'Videoconsulta', editable: true },
  { action: 'camera', code: 'KeyV', label: 'Encender o apagar la cámara', scope: 'Videoconsulta', editable: true },
  { action: 'raiseHand', code: 'KeyP', label: 'Pedir la palabra', scope: 'Videoconsulta', editable: true },
];

export const ROOM_ACTIONS: ShortcutAction[] = ['subtitles', 'transcript', 'interpreter', 'mic', 'camera', 'raiseHand'];

const STORAGE_KEY = 'ssb_shortcuts_v1';

export type ShortcutCodes = Record<ShortcutAction, string>;

export function defaultShortcutCodes(): ShortcutCodes {
  return Object.fromEntries(SHORTCUT_DEFS.map((d) => [d.action, d.code])) as ShortcutCodes;
}

export function loadShortcutCodes(): ShortcutCodes {
  const defaults = defaultShortcutCodes();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<ShortcutCodes>) };
  } catch {
    return defaults;
  }
}

function persist(codes: ShortcutCodes): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // Sin almacenamiento: los atajos siguen funcionando con los valores por defecto
  }
  window.dispatchEvent(new CustomEvent('ssb:shortcuts-changed', { detail: codes }));
}

/** Convierte una tecla escrita por el usuario (una letra o número) en KeyboardEvent.code. */
export function keyToCode(key: string): string | null {
  const k = key.trim().toUpperCase();
  if (/^[A-Z]$/.test(k)) return `Key${k}`;
  if (/^[0-9]$/.test(k)) return `Digit${k}`;
  return null;
}

export function codeToLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  return code;
}

export function shortcutLabel(code: string): string {
  return `Alt+Shift+${codeToLabel(code)}`;
}

/**
 * Reasigna un atajo. Devuelve el nombre de la acción en conflicto si la tecla ya está usada
 * (WCAG 3.3.1: el error se explica en lugar de guardarse en silencio).
 */
export function updateShortcut(action: ShortcutAction, key: string): { ok: true } | { ok: false; reason: string } {
  const code = keyToCode(key);
  if (!code) return { ok: false, reason: 'Escribe una sola letra (A-Z) o un número (0-9).' };
  const codes = loadShortcutCodes();
  const clash = SHORTCUT_DEFS.find((d) => d.action !== action && codes[d.action] === code);
  if (clash) {
    return { ok: false, reason: `Alt+Shift+${codeToLabel(code)} ya se usa para "${clash.label}". Elige otra tecla.` };
  }
  persist({ ...codes, [action]: code });
  return { ok: true };
}

export function resetShortcuts(): void {
  persist(defaultShortcutCodes());
}

/** Devuelve la acción si el evento es Alt+Shift+tecla asignada. */
export function matchShortcut(event: KeyboardEvent, codes: ShortcutCodes): ShortcutAction | null {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return null;
  const found = (Object.keys(codes) as ShortcutAction[]).find((a) => codes[a] === event.code);
  return found ?? null;
}
