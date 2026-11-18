/**
 * Tratamiento: receta electrónica, recordatorios de toma y cumplimiento.
 * RF-15 emitir receta y generar recordatorios · RF-06 notificar y registrar la toma
 * RF-17 historial de tomas registradas y omitidas.
 */
import { collection, isoDate, uid } from './db';
import { notify } from './notifications';

export interface PrescriptionItem {
  id: string;
  medicine: string;
  dose: string;
  everyHours: number;
  days: number;
  firstTime: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  patientId: string;
  professionalId: string;
  items: PrescriptionItem[];
  createdAt: string;
}

export type ReminderStatus = 'PENDIENTE' | 'TOMADA' | 'OMITIDA';

export interface Reminder {
  id: string;
  patientId: string;
  prescriptionId: string;
  itemId: string;
  title: string;
  dueAt: string;
  status: ReminderStatus;
  registeredAt?: string;
}

/** Una toma se considera omitida si pasaron más de 2 horas sin registrarla. */
const GRACE_MS = 2 * 60 * 60 * 1000;

export const prescriptions = collection<Prescription>('prescriptions', () => [
  {
    id: 'rx-000',
    appointmentId: 'apt-000',
    patientId: 'pac-002',
    professionalId: 'prof-001',
    createdAt: `${isoDate(-7)}T10:30:00`,
    items: [
      { id: 'rxi-1', medicine: 'Losartán', dose: '50 mg, 1 pastilla', everyHours: 24, days: 30, firstTime: '08:00' },
      { id: 'rxi-2', medicine: 'Timolol 0,5 %', dose: '1 gota en cada ojo', everyHours: 12, days: 30, firstTime: '08:00' },
    ],
  },
]);

function buildReminders(rx: Prescription, startDate: string, horizonDays = 10): Reminder[] {
  const list: Reminder[] = [];
  rx.items.forEach((item) => {
    const start = new Date(`${startDate}T${item.firstTime}:00`);
    const limit = Math.min(item.days, horizonDays) * 24;
    for (let h = 0; h < limit; h += item.everyHours) {
      const due = new Date(start.getTime() + h * 3600 * 1000);
      list.push({
        id: uid('rem'),
        patientId: rx.patientId,
        prescriptionId: rx.id,
        itemId: item.id,
        title: `${item.medicine} — ${item.dose}`,
        dueAt: due.toISOString(),
        status: 'PENDIENTE',
      });
    }
  });
  return list;
}

export const reminders = collection<Reminder>('reminders', () => {
  // Historial de una semana con algunas tomas registradas y otras omitidas, más las próximas.
  const seeded = buildReminders(prescriptions.all()[0], isoDate(-6), 9);
  const now = Date.now();
  return seeded.map((r, i) => {
    const due = new Date(r.dueAt).getTime();
    if (due + GRACE_MS < now) {
      const taken = i % 5 !== 3;
      return { ...r, status: taken ? 'TOMADA' : 'OMITIDA', registeredAt: taken ? new Date(due + 10 * 60000).toISOString() : undefined };
    }
    return r;
  });
});

/** Marca como omitidas las tomas vencidas y devuelve los recordatorios del paciente ordenados. */
export function remindersOf(patientId: string): Reminder[] {
  const now = Date.now();
  return reminders
    .where((r) => r.patientId === patientId)
    .map((r) => (r.status === 'PENDIENTE' && new Date(r.dueAt).getTime() + GRACE_MS < now ? { ...r, status: 'OMITIDA' as const } : r))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** RF-06: registrar la toma en un solo paso. */
export function registerDose(reminderId: string): void {
  reminders.update(reminderId, { status: 'TOMADA', registeredAt: new Date().toISOString() });
}

/** RF-15: emite la receta y genera los recordatorios de toma desde hoy. */
export function issuePrescription(data: Omit<Prescription, 'id' | 'createdAt'>): Prescription {
  const rx = prescriptions.insert({ ...data, id: uid('rx'), createdAt: new Date().toISOString() });
  buildReminders(rx, isoDate(0)).forEach((r) => reminders.insert(r));
  notify('paciente', rx.patientId, `Tu médico emitió una receta con ${rx.items.length} medicamento(s). Ya tienes tus recordatorios.`);
  return rx;
}

export const prescriptionsOf = (patientId: string) =>
  prescriptions.where((p) => p.patientId === patientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** RF-17: cumplimiento del tratamiento. */
export function adherenceOf(patientId: string): { taken: number; missed: number; pending: number; percent: number } {
  const list = remindersOf(patientId);
  const taken = list.filter((r) => r.status === 'TOMADA').length;
  const missed = list.filter((r) => r.status === 'OMITIDA').length;
  const pending = list.filter((r) => r.status === 'PENDIENTE').length;
  const done = taken + missed;
  return { taken, missed, pending, percent: done ? Math.round((taken / done) * 100) : 100 };
}
