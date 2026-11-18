/**
 * Profesionales de salud (U2, rol principal), su horario por día y la duración de cada tipo de consulta.
 * RF-08: publicar horario por día y definir la duración de cada tipo de consulta.
 */
import { collection, isoDate, toMinutes, uid } from './db';

export type ConsultType = 'general' | 'interprete' | 'control';

export const CONSULT_TYPE_LABELS: Record<ConsultType, string> = {
  general: 'General',
  interprete: 'Con intérprete de señas',
  control: 'De control',
};

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  registry: string;
  durations: Record<ConsultType, number>;
}

export interface WorkDay {
  id: string;
  professionalId: string;
  date: string;
  start: string;
  end: string;
}

export const professionals = collection<Professional>('professionals', () => [
  {
    id: 'prof-001',
    name: 'Dra. Valeria Viteri',
    specialty: 'Medicina Familiar',
    registry: 'MSP-130982',
    durations: { general: 20, interprete: 35, control: 15 },
  },
  {
    id: 'prof-002',
    name: 'Dr. Andrés Cedeño',
    specialty: 'Neurología y Rehabilitación',
    registry: 'MSP-118455',
    durations: { general: 30, interprete: 45, control: 20 },
  },
]);

export const workDays = collection<WorkDay>('work_days', () => [
  ...[0, 1, 2, 3].map((d) => ({ id: `wd-v${d}`, professionalId: 'prof-001', date: isoDate(d), start: '08:00', end: '13:00' })),
  ...[1, 2, 3].map((d) => ({ id: `wd-c${d}`, professionalId: 'prof-002', date: isoDate(d), start: '09:00', end: '12:00' })),
]);

export function workDaysOf(professionalId: string): WorkDay[] {
  return workDays
    .where((w) => w.professionalId === professionalId)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

/** Devuelve el bloque que se superpone, si existe (lo usa el formulario para explicar el error). */
export function overlappingWorkDay(professionalId: string, date: string, start: string, end: string): WorkDay | undefined {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return workDaysOf(professionalId).find(
    (w) => w.date === date && s < toMinutes(w.end) && e > toMinutes(w.start)
  );
}

export function publishWorkDay(professionalId: string, date: string, start: string, end: string): WorkDay {
  return workDays.insert({ id: uid('wd'), professionalId, date, start, end });
}

export function setDurations(professionalId: string, durations: Record<ConsultType, number>): void {
  professionals.update(professionalId, { durations });
}
