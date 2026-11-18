/**
 * Validación accesible de formularios (F4).
 * - 3.3.1 Identificación de errores: mensaje en texto junto al campo y resumen al inicio con enlaces.
 * - 3.3.3 Sugerencias ante errores: cada regla devuelve cómo corregir el dato.
 * - 4.1.2 / 4.1.3: aria-invalid en el campo y anuncio del número de errores.
 */
import { announce } from './announce';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface FieldRule {
  /** id del campo (o del primer control del grupo) */
  id: string;
  /** Nombre visible del campo para el resumen */
  label: string;
  /** Devuelve la sugerencia de corrección o null si el valor es válido */
  check: (value: string, field: Field | null) => string | null;
}

export const rules = {
  required: (hint: string) => (v: string) => (v.trim() ? null : hint),
  minLength: (n: number, hint: string) => (v: string) => (v.trim().length >= n ? null : hint),
  pattern: (re: RegExp, hint: string) => (v: string) => (re.test(v.trim()) ? null : hint),
  futureDate: (hint: string) => (v: string) => {
    if (!v) return hint;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${v}T00:00:00`) > today ? null : hint;
  },
  checked: (hint: string) => (_v: string, f: Field | null) => ((f as HTMLInputElement | null)?.checked ? null : hint),
};

function errorElementFor(field: HTMLElement): HTMLElement {
  const errId = `err-${field.id}`;
  let err = document.getElementById(errId);
  if (!err) {
    err = document.createElement('span');
    err.id = errId;
    err.className = 'field-error';
    const host = field.closest('.form-group, .check-card, fieldset') ?? field.parentElement!;
    if (host.classList.contains('check-card')) host.after(err);
    else host.appendChild(err);
  }
  const described = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  described.add(errId);
  field.setAttribute('aria-describedby', [...described].join(' '));
  return err;
}

export function setFieldError(field: HTMLElement, message: string): void {
  const err = errorElementFor(field);
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  err.textContent = message ? `⚠️ ${message}` : '';
  err.classList.toggle('visible', Boolean(message));
}

export function clearErrors(form: HTMLElement, summary?: HTMLElement | null): void {
  form.querySelectorAll<HTMLElement>('[aria-invalid="true"]').forEach((f) => setFieldError(f, ''));
  if (summary) {
    summary.hidden = true;
    summary.innerHTML = '';
  }
}

/**
 * Valida y, si hay errores, muestra el resumen con enlaces a cada campo y mueve el foco al resumen.
 */
export function validateForm(form: HTMLElement, fieldRules: FieldRule[], summary: HTMLElement | null): boolean {
  clearErrors(form, summary);
  const errors: Array<{ field: HTMLElement; label: string; message: string }> = [];

  for (const rule of fieldRules) {
    const field = document.getElementById(rule.id) as Field | null;
    const message = rule.check(field?.value ?? '', field);
    if (message && field) {
      setFieldError(field, message);
      errors.push({ field, label: rule.label, message });
    }
  }

  if (errors.length === 0) return true;

  if (summary) {
    const title = errors.length === 1 ? 'Hay 1 error en el formulario' : `Hay ${errors.length} errores en el formulario`;
    summary.innerHTML = `<h2 class="error-summary-title">${title}</h2><p>Selecciona cada error para ir al campo:</p><ul></ul>`;
    const list = summary.querySelector('ul')!;
    errors.forEach(({ field, label, message }) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${field.id}`;
      a.textContent = `${label}: ${message}`;
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        field.focus();
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    summary.hidden = false;
    summary.focus();
  } else {
    errors[0].field.focus();
  }
  announce(`${errors.length} error${errors.length > 1 ? 'es' : ''} en el formulario. Revisa los campos marcados.`, 'assertive');
  return false;
}

export function valueOf(id: string): string {
  return ((document.getElementById(id) as Field | null)?.value ?? '').trim();
}

export function isChecked(id: string): boolean {
  return Boolean((document.getElementById(id) as HTMLInputElement | null)?.checked);
}

export function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
