/**
 * Cliente del canal en tiempo real de la videoconsulta.
 * Modo "agente": WebSocket al agente Rust (backend/agente-ia), que genera glosas LSEc y segmentos de lector.
 * Modo "local": si el agente no está encendido, BroadcastChannel entre pestañas + glosador local reducido.
 */
import { agentBaseUrl } from './ai-harness/providers';

export interface Glosa {
  glosa: string;
  tipo: 'lexica' | 'dactilologia' | 'numero';
  original: string;
  pictograma: string | null;
  duracionMs: number;
}

export interface Oracion {
  glosas: Glosa[];
  pregunta: 'abierta' | 'cerrada' | null;
  expresionFacial: string | null;
}

export interface Traduccion {
  oraciones: Oracion[];
  textoGlosado: string;
  cobertura: number;
  duracionTotalMs: number;
  aviso: string;
}

export interface SegmentoLector {
  texto: string;
  prioridad: 'cortes' | 'urgente';
  hablante: string | null;
  pausaMs: number;
}

export type RoomEvent =
  | { tipo: 'transcripcion'; hablante: string; texto: string; ts: string; senas: Traduccion; lector: SegmentoLector[] }
  | { tipo: 'turno'; quien: string; accion: 'pedir' | 'ceder' | 'conceder'; ts: string }
  | { tipo: 'presencia'; rol: string; nombre: string; estado: string; apoyos: string[] }
  | { tipo: 'error'; mensaje: string };

export type OutgoingMessage =
  | { tipo: 'transcripcion'; hablante: string; texto: string }
  | { tipo: 'turno'; quien: string; accion: 'pedir' | 'ceder' | 'conceder' }
  | { tipo: 'presencia'; rol: string; nombre: string; estado: string; apoyos?: string[] };

export interface RoomConnection {
  mode: 'agente' | 'local';
  send(msg: OutgoingMessage): void;
  close(): void;
}

// ---------------- Glosador local (respaldo reducido del glosador Rust) ----------------

const LEX: Record<string, [string, string | null]> = {
  hola: ['HOLA', null], gracias: ['GRACIAS', null], si: ['SÍ', null], no: ['NO', null], bien: ['BIEN', null],
  doctor: ['MÉDICO', 'medico'], doctora: ['MÉDICO', 'medico'], medico: ['MÉDICO', 'medico'],
  dolor: ['DOLOR', 'dolor'], duele: ['DOLOR', 'dolor'], fiebre: ['FIEBRE', 'termometro'], cabeza: ['CABEZA', null],
  garganta: ['GARGANTA', null], tos: ['TOS', null], mareo: ['MAREO', null], presion: ['PRESIÓN', 'corazon'],
  pastilla: ['PASTILLA', 'pastilla'], pastillas: ['PASTILLA', 'pastilla'], jarabe: ['JARABE', 'jarabe'],
  gotas: ['GOTAS', 'gotas'], medicina: ['MEDICINA', 'pastilla'], tomar: ['TOMAR', 'pastilla'], tome: ['TOMAR', 'pastilla'],
  tomo: ['TOMAR', 'pastilla'], comer: ['COMER', 'comer'], agua: ['AGUA', 'agua'], dormir: ['DORMIR', 'luna'],
  hoy: ['HOY', 'calendario'], manana: ['MAÑANA', 'sol'], noche: ['NOCHE', 'luna'], dia: ['DÍA', 'calendario'],
  dias: ['DÍA', 'calendario'], hora: ['HORA', 'reloj'], horas: ['HORA', 'reloj'], cada: ['CADA', 'reloj'],
  cita: ['CITA', 'calendario'], control: ['CONTROL', 'calendario'], urgencias: ['URGENCIA', 'alerta'],
  que: ['QUÉ', null], como: ['CÓMO', null], cuando: ['CUÁNDO', null], donde: ['DÓNDE', null], cuanto: ['CUÁNTO', null],
  entender: ['ENTENDER', null], entiende: ['ENTENDER', null], repetir: ['REPETIR', null], usted: ['TÚ', null], yo: ['YO', null],
};
const SKIP = new Set('el la los las un una unos unas de del a al en por para con se lo le me te mi su y o es son esta estan hay'.split(' '));
const TIME = new Set(['HOY', 'MAÑANA', 'NOCHE']);
const WH = new Set(['QUÉ', 'CÓMO', 'CUÁNDO', 'DÓNDE', 'CUÁNTO']);

const norm = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function glosarLocal(texto: string): Traduccion {
  const oraciones: Oracion[] = [];
  for (const frase of texto.split(/(?<=[.?!;])/)) {
    const pregunta = /[?¿]/.test(frase);
    const glosas: Glosa[] = [];
    for (const w of frase.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
      const n = norm(w);
      if (/^\d+$/.test(n)) glosas.push({ glosa: n, tipo: 'numero', original: w, pictograma: null, duracionMs: 600 });
      else if (LEX[n]) glosas.push({ glosa: LEX[n][0], tipo: 'lexica', original: w, pictograma: LEX[n][1], duracionMs: 750 });
      else if (!SKIP.has(n) && n.length > 1) {
        const letras = w.toUpperCase().replace(/[^\p{L}]/gu, '').split('');
        glosas.push({ glosa: letras.join('-'), tipo: 'dactilologia', original: w, pictograma: null, duracionMs: 320 * letras.length });
      }
    }
    if (!glosas.length) continue;
    const time = glosas.filter((g) => TIME.has(g.glosa));
    const wh = pregunta ? glosas.filter((g) => WH.has(g.glosa)) : [];
    const rest = glosas.filter((g) => !TIME.has(g.glosa) && !wh.includes(g));
    oraciones.push({
      glosas: [...time, ...rest, ...wh],
      pregunta: pregunta ? (wh.length ? 'abierta' : 'cerrada') : null,
      expresionFacial: pregunta ? (wh.length ? 'Cejas fruncidas durante la pregunta.' : 'Cejas levantadas (pregunta de sí o no).') : null,
    });
  }
  const all = oraciones.flatMap((o) => o.glosas);
  return {
    oraciones,
    textoGlosado: oraciones.map((o) => o.glosas.map((g) => g.glosa).join(' ') + (o.pregunta ? '?' : '')).join(' // '),
    cobertura: all.length ? Math.round((all.filter((g) => g.tipo !== 'dactilologia').length / all.length) * 100) / 100 : 0,
    duracionTotalMs: all.reduce((s, g) => s + g.duracionMs, 0) + 400 * oraciones.length,
    aviso: 'Glosas de respaldo generadas en el navegador (agente Rust apagado). No reemplazan al intérprete acreditado.',
  };
}

function lectorLocal(texto: string, hablante: string): SegmentoLector[] {
  const expanded = texto
    .replace(/\bDra\./gi, 'doctora')
    .replace(/\bDr\./gi, 'doctor')
    .replace(/(\d)\s*mg\b/gi, '$1 miligramos')
    .replace(/(\d)\s*ml\b/gi, '$1 mililitros');
  return expanded
    .split(/(?<=[.?!;])\s+/)
    .filter((s) => s.trim())
    .map((s, i, arr) => ({
      texto: i === 0 ? `${hablante}: ${s}` : s,
      prioridad: /urgencia|emergencia|alarma|de inmediato/i.test(s) ? 'urgente' : 'cortes',
      hablante,
      pausaMs: i + 1 === arr.length ? 0 : 300,
    }));
}

function localEvent(msg: OutgoingMessage): RoomEvent {
  const ts = new Date().toISOString();
  if (msg.tipo === 'transcripcion') {
    return { ...msg, ts, senas: glosarLocal(msg.texto), lector: lectorLocal(msg.texto, msg.hablante) };
  }
  if (msg.tipo === 'turno') return { ...msg, ts };
  return { ...msg, apoyos: msg.apoyos ?? [] };
}

// ---------------- Conexión ----------------

function connectLocal(roomId: string, onEvent: (e: RoomEvent) => void): RoomConnection {
  const channel = new BroadcastChannel(`ssb-sala-${roomId}`);
  channel.onmessage = (e) => onEvent(e.data as RoomEvent);
  return {
    mode: 'local',
    send(msg) {
      const ev = localEvent(msg);
      channel.postMessage(ev);
      onEvent(ev); // BroadcastChannel no entrega el mensaje a la misma pestaña
    },
    close: () => channel.close(),
  };
}

/** Conecta a la sala: intenta el agente Rust durante 1,5 s y, si no responde, usa el modo local. */
export function connectRoom(roomId: string, onEvent: (e: RoomEvent) => void): Promise<RoomConnection> {
  return new Promise((resolve) => {
    let settled = false;
    const fallback = () => {
      if (settled) return;
      settled = true;
      resolve(connectLocal(roomId, onEvent));
    };
    try {
      const url = `${agentBaseUrl().replace(/^http/, 'ws')}/v1/tiempo-real?sala=${encodeURIComponent(roomId)}`;
      const ws = new WebSocket(url);
      const timer = window.setTimeout(() => {
        ws.close();
        fallback();
      }, 1500);
      ws.onopen = () => {
        window.clearTimeout(timer);
        if (settled) return ws.close();
        settled = true;
        ws.onmessage = (e) => onEvent(JSON.parse(e.data) as RoomEvent);
        resolve({ mode: 'agente', send: (msg) => ws.send(JSON.stringify(msg)), close: () => ws.close() });
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        fallback();
      };
    } catch {
      fallback();
    }
  });
}
