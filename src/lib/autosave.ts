/**
 * Borradores automáticos de formularios (F4 · WCAG 2.2.5 Nueva autenticación).
 * Si la sesión expira o se cierra la pestaña, al volver se recuperan los datos escritos.
 * Nunca guarda contraseñas.
 */
import { announce } from './announce';

const PREFIX = 'ssb_draft_';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fields(form: HTMLFormElement): Field[] {
  return Array.from(form.elements).filter(
    (el): el is Field =>
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) &&
      Boolean(el.id) &&
      !(el instanceof HTMLInputElement && ['password', 'file', 'submit', 'button'].includes(el.type))
  );
}

function snapshot(form: HTMLFormElement): Record<string, string | boolean> {
  const data: Record<string, string | boolean> = {};
  fields(form).forEach((f) => {
    data[f.id] = f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio') ? f.checked : f.value;
  });
  return data;
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Activa el autoguardado. Devuelve true si se restauró un borrador.
 * `onRestore` permite a la página recalcular vistas dependientes (por ejemplo, apoyos visibles).
 */
export function autosaveForm(form: HTMLFormElement, key: string, onRestore?: () => void): boolean {
  let restored = false;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw) {
      const data = JSON.parse(raw) as Record<string, string | boolean>;
      fields(form).forEach((f) => {
        if (!(f.id in data)) return;
        if (f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio')) f.checked = Boolean(data[f.id]);
        else f.value = String(data[f.id]);
      });
      restored = true;
    }
  } catch {
    /* borrador dañado: se ignora */
  }

  let timer = 0;
  const save = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(snapshot(form)));
      } catch {
        /* sin almacenamiento */
      }
    }, 300);
  };
  form.addEventListener('input', save);
  form.addEventListener('change', save);

  if (restored) {
    const note = document.createElement('div');
    note.className = 'alert-box mb-2 draft-note';
    note.setAttribute('role', 'status');
    note.innerHTML = '<strong>Recuperamos los datos que habías escrito.</strong> ';
    const discard = document.createElement('button');
    discard.type = 'button';
    discard.className = 'btn btn-secondary';
    discard.textContent = 'Empezar de nuevo';
    discard.addEventListener('click', () => {
      clearDraft(key);
      form.reset();
      note.remove();
      onRestore?.();
      announce('Formulario vaciado.');
    });
    note.appendChild(discard);
    form.prepend(note);
    onRestore?.();
  }
  return restored;
}
