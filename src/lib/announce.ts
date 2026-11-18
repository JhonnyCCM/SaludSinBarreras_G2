/**
 * Mensajes de estado para lectores de pantalla sin mover el foco (F4 · WCAG 4.1.3).
 * Usa dos regiones vivas creadas en BaseLayout: una cortés y otra urgente (errores).
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return;
  const region = document.getElementById(priority === 'assertive' ? 'ssb-announcer-assertive' : 'ssb-announcer');
  if (!region) return;
  // Vaciar y volver a escribir garantiza que el lector repita mensajes iguales.
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = message;
  }, 60);
}
