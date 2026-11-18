/**
 * Piezas de interfaz compartidas por los paneles de cada rol.
 */
import { announce } from './announce';
import { triggerVisualAlert } from './accessibility';
import { STATUS_LABELS, type Appointment } from './data/appointments';
import { formatDate, formatDateTime } from './data/db';
import { latestRequestFor, interpreters } from './data/interpreters';
import { inboxOf, markAllRead, type Role } from './data/notifications';
import { CONSULT_TYPE_LABELS, professionals } from './data/professionals';
import { esc } from './forms';
import { getPatient } from './store';

const STATUS_BADGE: Record<Appointment['status'], string> = {
  RESERVADA: 'badge-warning',
  CONFIRMADA: 'badge-success',
  EN_CURSO: 'badge-info',
  ATENDIDA: 'badge',
  CANCELADA: 'badge-danger',
};

export function statusBadge(a: Appointment): string {
  return `<span class="badge ${STATUS_BADGE[a.status]}">${esc(STATUS_LABELS[a.status])}</span>`;
}

export function interpreterStatus(a: Appointment): string {
  if (a.type !== 'interprete') return '';
  const req = latestRequestFor(a.id);
  if (!req) return '<span class="badge badge-warning">Intérprete: sin solicitar</span>';
  const name = interpreters.get(req.interpreterId)?.fullName ?? 'Intérprete';
  const cls = req.status === 'ACEPTADA' ? 'badge-success' : req.status === 'RECHAZADA' ? 'badge-danger' : 'badge-warning';
  const txt = req.status === 'ACEPTADA' ? `${name} confirmado` : req.status === 'RECHAZADA' ? `${name} rechazó` : `esperando a ${name}`;
  return `<span class="badge ${cls}">Intérprete: ${esc(txt)}</span>`;
}

/** Tarjeta de cita reutilizable. `actions` es HTML con botones o enlaces. */
export function appointmentCard(a: Appointment, viewer: Role, actions = ''): string {
  const prof = professionals.get(a.professionalId);
  const patient = getPatient(a.patientId);
  const who = viewer === 'paciente' ? `${prof?.name ?? ''} · ${a.specialty}` : `${patient?.fullName ?? 'Paciente'}`;
  return `<article class="apt-card" data-apt="${esc(a.id)}">
    <div class="apt-time"><strong>${esc(a.time)}</strong><span>${esc(a.durationMin)} min</span></div>
    <div class="apt-body">
      <h3 class="apt-title">${esc(who)}</h3>
      <p class="form-hint" style="margin: 0;">${esc(formatDate(a.date))} · ${esc(CONSULT_TYPE_LABELS[a.type])}</p>
      <p style="margin: 0.25rem 0;">${esc(a.reason)}</p>
      <div class="flex-wrap">${statusBadge(a)} ${interpreterStatus(a)}</div>
      ${actions ? `<div class="flex-wrap mt-1">${actions}</div>` : ''}
    </div>
  </article>`;
}

/** Bandeja de avisos con alerta visual para los nuevos (F3 · 1.3.3). */
export function mountInbox(container: HTMLElement, role: Role, userId: string): () => void {
  let seen = new Set(inboxOf(role, userId).map((n) => n.id));
  const render = () => {
    const list = inboxOf(role, userId);
    const fresh = list.filter((n) => !seen.has(n.id));
    fresh.forEach((n) => triggerVisualAlert(n.message));
    seen = new Set(list.map((n) => n.id));
    const unread = list.filter((n) => !n.read).length;
    container.innerHTML = `
      <div class="flex-wrap" style="justify-content: space-between;">
        <h2 style="margin: 0;">🔔 Avisos ${unread ? `<span class="badge badge-warning">${unread} nuevo${unread > 1 ? 's' : ''}</span>` : ''}</h2>
        ${unread ? '<button type="button" class="btn btn-secondary" data-mark-read>Marcar como leídos</button>' : ''}
      </div>
      ${list.length
        ? `<ul class="inbox">${list.slice(0, 6).map((n) => `<li class="${n.read ? '' : 'unread'}"><span>${esc(n.message)}</span><span class="form-hint">${esc(formatDateTime(n.at))}</span></li>`).join('')}</ul>`
        : '<p class="form-hint">No tienes avisos.</p>'}`;
    container.querySelector('[data-mark-read]')?.addEventListener('click', () => {
      markAllRead(role, userId);
      announce('Avisos marcados como leídos.');
    });
  };
  render();
  return render;
}
