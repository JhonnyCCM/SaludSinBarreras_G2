/**
 * Avisos entre roles: cambios de cita, solicitudes de intérprete, resúmenes firmados.
 * Los recibe el panel de cada usuario y se muestran también como alerta visual (F3 · 1.3.3).
 */
import { collection, uid } from './db';

export type Role = 'paciente' | 'profesional' | 'interprete';

export interface Notification {
  id: string;
  role: Role;
  userId: string;
  message: string;
  at: string;
  read: boolean;
}

export const notifications = collection<Notification>('notifications', () => []);

export function notify(role: Role, userId: string, message: string): void {
  notifications.insert({ id: uid('ntf'), role, userId, message, at: new Date().toISOString(), read: false });
}

export function inboxOf(role: Role, userId: string): Notification[] {
  return notifications.where((n) => n.role === role && n.userId === userId).sort((a, b) => b.at.localeCompare(a.at));
}

export function markAllRead(role: Role, userId: string): void {
  inboxOf(role, userId)
    .filter((n) => !n.read)
    .forEach((n) => notifications.update(n.id, { read: true }));
}
