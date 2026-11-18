/**
 * Colecciones persistidas en localStorage para el prototipo.
 * Cada cambio emite 'ssb:data-changed' en la pestaña actual y el evento 'storage' llega a las demás,
 * así una pestaña del paciente y otra del profesional se mantienen sincronizadas en la demo.
 */

export interface Entity {
  id: string;
}

const EVENT = 'ssb:data-changed';
const PREFIX = 'ssb_v2_';

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function collection<T extends Entity>(name: string, seed: () => T[]) {
  const key = PREFIX + name;

  const read = (): T[] => {
    if (typeof window === 'undefined') return seed();
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T[];
    } catch {
      /* dato dañado: se vuelve a sembrar */
    }
    const initial = seed();
    write(initial, false);
    return initial;
  };

  const write = (list: T[], notify = true): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* sin almacenamiento disponible */
    }
    if (notify) window.dispatchEvent(new CustomEvent(EVENT, { detail: { name } }));
  };

  return {
    name,
    all: read,
    get: (id: string) => read().find((x) => x.id === id),
    where: (pred: (x: T) => boolean) => read().filter(pred),
    insert(item: T): T {
      write([item, ...read()]);
      return item;
    },
    update(id: string, patch: Partial<T> | ((x: T) => Partial<T>)): T | undefined {
      let updated: T | undefined;
      write(
        read().map((x) => {
          if (x.id !== id) return x;
          updated = { ...x, ...(typeof patch === 'function' ? patch(x) : patch) };
          return updated;
        })
      );
      return updated;
    },
    remove(id: string): void {
      write(read().filter((x) => x.id !== id));
    },
    reset(): void {
      write(seed());
    },
  };
}

/** Ejecuta `cb` cuando cambian datos en esta pestaña o en otra. */
export function onDataChange(cb: () => void): void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.startsWith(PREFIX)) cb();
  });
}

/** Restablece todos los datos de demostración. */
export function resetAllData(): void {
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX) || k.startsWith('ssb_patients'))
    .forEach((k) => window.localStorage.removeItem(k));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { name: '*' } }));
}

// ---------- Fechas relativas a hoy (la demo siempre tiene agenda del día) ----------
export function isoDate(offsetDays = 0, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const todayISO = () => isoDate(0);

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}
