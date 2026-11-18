/**
 * Revisión antes de enviar (F4 · WCAG 3.3.4 Prevención de errores).
 * Muestra un resumen de lo que se va a guardar y deja corregir o confirmar.
 * Usa <dialog> nativo: Esc equivale a "Corregir" y el foco vuelve al botón de origen (2.1.2).
 */
import { esc } from './forms';

export interface ReviewOptions {
  title: string;
  intro?: string;
  items: Array<[label: string, value: string]>;
  confirmLabel?: string;
  warning?: string;
}

export function confirmReview(options: ReviewOptions): Promise<boolean> {
  const opener = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.className = 'ssb-dialog';
  dialog.setAttribute('aria-labelledby', 'review-dialog-title');
  dialog.innerHTML = `
    <h2 id="review-dialog-title">${esc(options.title)}</h2>
    <p>${esc(options.intro ?? 'Revisa los datos antes de confirmar. Puedes volver a corregirlos.')}</p>
    <dl class="review-list">
      ${options.items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd>`).join('')}
    </dl>
    ${options.warning ? `<p class="alert-box warning">${esc(options.warning)}</p>` : ''}
    <div class="flex-wrap mt-2" style="justify-content: space-between;">
      <button type="button" class="btn btn-secondary" data-review="cancel">← Corregir datos</button>
      <button type="button" class="btn btn-primary" data-review="ok">${esc(options.confirmLabel ?? 'Confirmar y guardar')}</button>
    </div>
  `;
  document.body.appendChild(dialog);

  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      dialog.close();
      dialog.remove();
      opener?.focus();
      resolve(ok);
    };
    dialog.querySelector('[data-review="ok"]')!.addEventListener('click', () => finish(true));
    dialog.querySelector('[data-review="cancel"]')!.addEventListener('click', () => finish(false));
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(false);
    });
    dialog.showModal();
    (dialog.querySelector('[data-review="ok"]') as HTMLButtonElement).focus();
  });
}
