/**
 * Sesión de demostración por rol (FORM-11 Inicio de sesión).
 * Usuario: cédula (paciente), registro MSP (profesional) o código de acreditación (intérprete).
 */
import { interpreters } from './data/interpreters';
import type { Role } from './data/notifications';
import { professionals } from './data/professionals';
import { getPatients } from './store';

export type { Role };

export interface Session {
  role: Role;
  userId: string;
  name: string;
  startedAt: string;
}

export const DEMO_PASSWORD = 'salud2026';
const KEY = 'ssb_session_v1';

export const ROLE_LABELS: Record<Role, string> = {
  paciente: 'Paciente',
  profesional: 'Profesional de salud',
  interprete: 'Intérprete de señas',
};

export const ROLE_HOME: Record<Role, string> = {
  paciente: '/paciente',
  profesional: '/profesional',
  interprete: '/interprete',
};

export interface Account {
  role: Role;
  userId: string;
  name: string;
  username: string;
  detail: string;
}

export function demoAccounts(): Account[] {
  return [
    ...professionals.all().map((p) => ({ role: 'profesional' as const, userId: p.id, name: p.name, username: p.registry, detail: p.specialty })),
    ...getPatients().map((p) => ({
      role: 'paciente' as const,
      userId: p.id,
      name: p.fullName,
      username: p.cedula,
      detail: `Discapacidad ${p.disabilities.join(' y ')}`,
    })),
    ...interpreters.all().map((i) => ({ role: 'interprete' as const, userId: i.id, name: i.fullName, username: i.accreditationCode, detail: 'Lengua de Señas Ecuatoriana' })),
  ];
}

export function getSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function authenticate(role: Role, username: string, password: string): Account | { error: string; field: 'username' | 'password' } {
  const account = demoAccounts().find((a) => a.role === role && a.username.toLowerCase() === username.trim().toLowerCase());
  if (!account) return { error: `No encontramos un ${ROLE_LABELS[role].toLowerCase()} con ese usuario. Revisa el dato o elige una cuenta de prueba.`, field: 'username' };
  if (password !== DEMO_PASSWORD) return { error: 'La contraseña no coincide. En la demo es salud2026; puedes pegarla o usar tu gestor de contraseñas.', field: 'password' };
  return account;
}

export function startSession(account: Pick<Account, 'role' | 'userId' | 'name'>): Session {
  const session: Session = { role: account.role, userId: account.userId, name: account.name, startedAt: new Date().toISOString() };
  window.localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('ssb:session-changed', { detail: session }));
  return session;
}

export function endSession(): void {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent('ssb:session-changed', { detail: null }));
}

/**
 * Protege una página por rol. Si no hay sesión del rol correcto, lleva al inicio de sesión
 * y vuelve a esta página al entrar.
 */
export function requireRole(role: Role): Session | null {
  const s = getSession();
  if (s && s.role === role) return s;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login?rol=${role}&next=${next}`);
  return null;
}
