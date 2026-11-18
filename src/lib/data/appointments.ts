/**
 * Citas de videoconsulta.
 * RF-02 reservar en un horario publicado · RF-09 confirmar, reprogramar o cancelar con aviso
 * RF-12 iniciar la consulta · RF-17 agendar el control.
 */
import { collection, fromMinutes, isoDate, toMinutes, uid } from './db';
import { notify } from './notifications';
import { professionals, workDays, type ConsultType } from './professionals';

export type AppointmentStatus = 'RESERVADA' | 'CONFIRMADA' | 'EN_CURSO' | 'ATENDIDA' | 'CANCELADA';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  RESERVADA: 'Reservada, por confirmar',
  CONFIRMADA: 'Confirmada',
  EN_CURSO: 'En curso',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
};

export interface Appointment {
  id: string;
  patientId: string;
  professionalId: string;
  specialty: string;
  date: string;
  time: string;
  durationMin: number;
  type: ConsultType;
  status: AppointmentStatus;
  reason: string;
  comprehensionConfirmed?: boolean;
  createdAt: string;
}

const now = () => new Date().toISOString();

export const appointments = collection<Appointment>('appointments', () => [
  { id: 'apt-000', patientId: 'pac-002', professionalId: 'prof-001', specialty: 'Medicina Familiar', date: isoDate(-7), time: '10:00', durationMin: 20, type: 'general', status: 'ATENDIDA', reason: 'Control de presión arterial y glaucoma', comprehensionConfirmed: true, createdAt: now() },
  { id: 'apt-001', patientId: 'pac-001', professionalId: 'prof-001', specialty: 'Medicina Familiar', date: isoDate(0), time: '09:00', durationMin: 35, type: 'interprete', status: 'CONFIRMADA', reason: 'Dolor de garganta y fiebre desde hace tres días', createdAt: now() },
  { id: 'apt-002', patientId: 'pac-002', professionalId: 'prof-001', specialty: 'Medicina Familiar', date: isoDate(0), time: '10:00', durationMin: 20, type: 'general', status: 'CONFIRMADA', reason: 'Revisión de resultados de presión arterial', createdAt: now() },
  { id: 'apt-003', patientId: 'pac-003', professionalId: 'prof-001', specialty: 'Medicina Familiar', date: isoDate(0), time: '11:00', durationMin: 20, type: 'general', status: 'RESERVADA', reason: 'Mareos por la mañana y control de medicación', createdAt: now() },
  { id: 'apt-004', patientId: 'pac-001', professionalId: 'prof-001', specialty: 'Medicina Familiar', date: isoDate(1), time: '09:00', durationMin: 35, type: 'interprete', status: 'RESERVADA', reason: 'Control de resultados de laboratorio', createdAt: now() },
  { id: 'apt-005', patientId: 'pac-001', professionalId: 'prof-002', specialty: 'Neurología y Rehabilitación', date: isoDate(2), time: '10:00', durationMin: 45, type: 'interprete', status: 'CONFIRMADA', reason: 'Valoración de vértigo', createdAt: now() },
]);

export function sortByDateTime(list: Appointment[]): Appointment[] {
  return [...list].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export const ofPatient = (patientId: string) => sortByDateTime(appointments.where((a) => a.patientId === patientId));
export const ofProfessional = (professionalId: string) =>
  sortByDateTime(appointments.where((a) => a.professionalId === professionalId));
export const ofProfessionalOn = (professionalId: string, date: string) =>
  ofProfessional(professionalId).filter((a) => a.date === date);
export const isActive = (a: Appointment) => a.status !== 'CANCELADA' && a.status !== 'ATENDIDA';

/** Horarios libres de un profesional en una fecha para un tipo de consulta (RF-02). */
export function availableSlots(professionalId: string, date: string, type: ConsultType, ignoreId?: string): string[] {
  const prof = professionals.get(professionalId);
  if (!prof) return [];
  const duration = prof.durations[type];
  const busy = ofProfessionalOn(professionalId, date)
    .filter((a) => a.status !== 'CANCELADA' && a.id !== ignoreId)
    .map((a) => [toMinutes(a.time), toMinutes(a.time) + a.durationMin]);
  const slots: string[] = [];
  workDays
    .where((w) => w.professionalId === professionalId && w.date === date)
    .forEach((w) => {
      for (let t = toMinutes(w.start); t + duration <= toMinutes(w.end); t += 15) {
        if (busy.every(([s, e]) => t + duration <= s || t >= e)) slots.push(fromMinutes(t));
      }
    });
  return slots;
}

/** Fechas con horario publicado desde hoy en adelante. */
export function bookableDates(professionalId: string): string[] {
  const today = isoDate(0);
  return [...new Set(workDays.where((w) => w.professionalId === professionalId && w.date >= today).map((w) => w.date))].sort();
}

export function bookAppointment(input: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'durationMin' | 'specialty'>): Appointment {
  const prof = professionals.get(input.professionalId)!;
  const apt = appointments.insert({
    ...input,
    id: uid('apt'),
    specialty: prof.specialty,
    durationMin: prof.durations[input.type],
    status: 'RESERVADA',
    createdAt: now(),
  });
  notify('profesional', prof.id, `Nueva cita reservada para el ${apt.date} a las ${apt.time}.`);
  return apt;
}

export function confirmAppointment(id: string): void {
  const apt = appointments.update(id, { status: 'CONFIRMADA' });
  if (apt) notify('paciente', apt.patientId, `Tu cita del ${apt.date} a las ${apt.time} fue confirmada.`);
}

export function rescheduleAppointment(id: string, date: string, time: string, interpreterId?: string): void {
  const apt = appointments.update(id, { date, time, status: 'CONFIRMADA' });
  if (!apt) return;
  notify('paciente', apt.patientId, `Tu cita fue reprogramada para el ${date} a las ${time}.`);
  if (interpreterId) notify('interprete', interpreterId, `La cita que interpretas fue reprogramada para el ${date} a las ${time}.`);
}

export function cancelAppointment(id: string, interpreterId?: string): void {
  const apt = appointments.update(id, { status: 'CANCELADA' });
  if (!apt) return;
  notify('paciente', apt.patientId, `Tu cita del ${apt.date} a las ${apt.time} fue cancelada.`);
  if (interpreterId) notify('interprete', interpreterId, `La cita del ${apt.date} a las ${apt.time} fue cancelada.`);
}

export const startAppointment = (id: string) => appointments.update(id, { status: 'EN_CURSO' });
export const finishAppointment = (id: string) => appointments.update(id, { status: 'ATENDIDA' });
