/**
 * Intérpretes de Lengua de Señas Ecuatoriana (U3) y solicitudes de interpretación.
 * RF-18 acreditación con vencimiento y disponibilidad · RF-11 el profesional solicita solo a intérpretes
 * vigentes y libres · RF-19 el intérprete acepta o rechaza; si rechaza, la solicitud vuelve al profesional.
 */
import { appointments, type Appointment } from './appointments';
import { collection, isoDate, toMinutes, uid } from './db';
import { notify } from './notifications';

export interface Interpreter {
  id: string;
  fullName: string;
  accreditationCode: string;
  validUntil: string;
  /** 0 = domingo … 6 = sábado */
  days: number[];
  from: string;
  to: string;
}

export type RequestStatus = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';

export interface InterpreterRequest {
  id: string;
  appointmentId: string;
  interpreterId: string;
  professionalId: string;
  status: RequestStatus;
  reason?: string;
  createdAt: string;
  respondedAt?: string;
}

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const interpreters = collection<Interpreter>('interpreters', () => [
  { id: 'int-001', fullName: 'Lic. Gabriela Intriago', accreditationCode: 'CONADIS-LSEC-0418', validUntil: isoDate(280), days: [1, 2, 3, 4, 5], from: '08:00', to: '14:00' },
  { id: 'int-002', fullName: 'Lic. Mateo Quintero', accreditationCode: 'CONADIS-LSEC-0792', validUntil: isoDate(360), days: [0, 1, 2, 3, 4, 5, 6], from: '08:00', to: '18:00' },
  { id: 'int-003', fullName: 'Lic. Paola Mera', accreditationCode: 'CONADIS-LSEC-0311', validUntil: isoDate(-10), days: [1, 2, 3, 4, 5], from: '08:00', to: '16:00' },
]);

export const requests = collection<InterpreterRequest>('interpreter_requests', () => [
  { id: 'req-001', appointmentId: 'apt-001', interpreterId: 'int-001', professionalId: 'prof-001', status: 'ACEPTADA', createdAt: new Date().toISOString(), respondedAt: new Date().toISOString() },
  { id: 'req-002', appointmentId: 'apt-005', interpreterId: 'int-001', professionalId: 'prof-002', status: 'PENDIENTE', createdAt: new Date().toISOString() },
]);

export const isAccreditationValid = (i: Interpreter, onDate = isoDate(0)) => i.validUntil >= onDate;

function weekday(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

function overlaps(a: Appointment, b: Appointment): boolean {
  if (a.date !== b.date) return false;
  const s1 = toMinutes(a.time);
  const s2 = toMinutes(b.time);
  return s1 < s2 + b.durationMin && s2 < s1 + a.durationMin;
}

/** Sesión ya aceptada por el intérprete que choca con la cita, si existe. */
export function conflictingSession(interpreterId: string, apt: Appointment): Appointment | undefined {
  return requests
    .where((r) => r.interpreterId === interpreterId && r.status === 'ACEPTADA' && r.appointmentId !== apt.id)
    .map((r) => appointments.get(r.appointmentId))
    .find((other): other is Appointment => Boolean(other && other.status !== 'CANCELADA' && overlaps(other, apt)));
}

/** RF-11: intérpretes con acreditación vigente, que trabajan ese día y hora, y sin otra sesión aceptada. */
export function eligibleInterpreters(apt: Appointment): Interpreter[] {
  const start = toMinutes(apt.time);
  return interpreters.where(
    (i) =>
      isAccreditationValid(i, apt.date) &&
      i.days.includes(weekday(apt.date)) &&
      start >= toMinutes(i.from) &&
      start + apt.durationMin <= toMinutes(i.to) &&
      !conflictingSession(i.id, apt)
  );
}

export function latestRequestFor(appointmentId: string): InterpreterRequest | undefined {
  return requests.where((r) => r.appointmentId === appointmentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function acceptedInterpreterFor(appointmentId: string): Interpreter | undefined {
  const req = requests.where((r) => r.appointmentId === appointmentId && r.status === 'ACEPTADA')[0];
  return req ? interpreters.get(req.interpreterId) : undefined;
}

export function requestsOf(interpreterId: string): InterpreterRequest[] {
  return requests.where((r) => r.interpreterId === interpreterId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function sendRequest(appointmentId: string, interpreterId: string, professionalId: string): InterpreterRequest {
  const apt = appointments.get(appointmentId)!;
  const req = requests.insert({ id: uid('req'), appointmentId, interpreterId, professionalId, status: 'PENDIENTE', createdAt: new Date().toISOString() });
  notify('interprete', interpreterId, `Nueva solicitud de interpretación: ${apt.date} a las ${apt.time} (${apt.specialty}).`);
  return req;
}

/** RF-19. Devuelve un error legible si aceptar crearía dos sesiones a la misma hora. */
export function respondRequest(requestId: string, accept: boolean, reason = ''): { ok: true } | { ok: false; reason: string } {
  const req = requests.get(requestId);
  if (!req) return { ok: false, reason: 'La solicitud ya no existe.' };
  const apt = appointments.get(req.appointmentId)!;
  if (accept) {
    const clash = conflictingSession(req.interpreterId, apt);
    if (clash) return { ok: false, reason: `Ya aceptaste otra sesión el ${clash.date} a las ${clash.time}.` };
  }
  requests.update(requestId, { status: accept ? 'ACEPTADA' : 'RECHAZADA', reason, respondedAt: new Date().toISOString() });
  notify(
    'profesional',
    req.professionalId,
    accept
      ? `El intérprete aceptó la cita del ${apt.date} a las ${apt.time}.`
      : `El intérprete rechazó la cita del ${apt.date} a las ${apt.time}${reason ? ` (${reason})` : ''}. Asigna otro intérprete.`
  );
  return { ok: true };
}

export function registerInterpreter(data: Omit<Interpreter, 'id'>): Interpreter {
  return interpreters.insert({ ...data, id: uid('int') });
}
