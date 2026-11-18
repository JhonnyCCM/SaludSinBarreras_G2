/**
 * Historia clínica, bitácora de accesos, permisos del paciente, incidencias y cierre del intérprete.
 * RF-16 registro con fecha, hora y autor · RF-07 el paciente decide quién ve sus datos
 * RF-23 incidencias técnicas · RF-24 cierre con declaración de confidencialidad y duración.
 */
import { collection, isoDate, uid } from './db';

export interface ClinicalRecord {
  id: string;
  patientId: string;
  appointmentId: string;
  reason: string;
  diagnosis: string;
  plan: string;
  author: string;
  createdAt: string;
}

export interface AccessLog {
  id: string;
  patientId: string;
  actor: string;
  action: string;
  at: string;
}

export interface Grant {
  id: string;
  patientId: string;
  name: string;
  relation: string;
  scope: 'resumen' | 'historia';
  active: boolean;
  createdAt: string;
}

export interface Incident {
  id: string;
  appointmentId: string;
  interpreterId: string;
  category: 'audio' | 'video' | 'conexion' | 'plataforma' | 'otro';
  description: string;
  createdAt: string;
}

export interface ServiceClosure {
  id: string; // = appointmentId
  interpreterId: string;
  minutes: number;
  confidentialityAccepted: true;
  closedAt: string;
}

export const records = collection<ClinicalRecord>('clinical_records', () => [
  {
    id: 'hc-000',
    patientId: 'pac-002',
    appointmentId: 'apt-000',
    reason: 'Control de presión arterial y glaucoma',
    diagnosis: 'Hipertensión arterial controlada. Glaucoma crónico en tratamiento.',
    plan: 'Continuar losartán 50 mg y timolol 0,5 %. Control en 15 días.',
    author: 'Dra. Valeria Viteri — MSP-130982',
    createdAt: `${isoDate(-7)}T10:28:00`,
  },
]);

export const accessLogs = collection<AccessLog>('access_logs', () => []);
export const grants = collection<Grant>('grants', () => [
  { id: 'gr-001', patientId: 'pac-002', name: 'Ana Mendoza', relation: 'Hija', scope: 'resumen', active: true, createdAt: new Date().toISOString() },
]);
export const incidents = collection<Incident>('incidents', () => []);
export const closures = collection<ServiceClosure>('service_closures', () => []);

export function logAccess(patientId: string, actor: string, action: string): void {
  accessLogs.insert({ id: uid('log'), patientId, actor, action, at: new Date().toISOString() });
}

export const recordsOf = (patientId: string) =>
  records.where((r) => r.patientId === patientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const logsOf = (patientId: string) =>
  accessLogs.where((l) => l.patientId === patientId).sort((a, b) => b.at.localeCompare(a.at));

export function addRecord(data: Omit<ClinicalRecord, 'id' | 'createdAt'>): ClinicalRecord {
  const rec = records.insert({ ...data, id: uid('hc'), createdAt: new Date().toISOString() });
  logAccess(data.patientId, data.author, 'Registró una atención en la historia clínica');
  return rec;
}

export const grantsOf = (patientId: string) => grants.where((g) => g.patientId === patientId);

export function addGrant(patientId: string, name: string, relation: string, scope: Grant['scope']): Grant {
  return grants.insert({ id: uid('gr'), patientId, name, relation, scope, active: true, createdAt: new Date().toISOString() });
}

export const toggleGrant = (id: string, active: boolean) => grants.update(id, { active });

export function reportIncident(data: Omit<Incident, 'id' | 'createdAt'>): Incident {
  return incidents.insert({ ...data, id: uid('inc'), createdAt: new Date().toISOString() });
}

export function closeService(appointmentId: string, interpreterId: string, minutes: number): ServiceClosure {
  return closures.insert({ id: appointmentId, interpreterId, minutes, confidentialityAccepted: true, closedAt: new Date().toISOString() });
}
