import { runDeterministicFallback } from './ai-harness/providers';
import { supportsFor, type SupportKey } from './supports';
import type {
  AnalyzeAccessibilityNeedsOutput,
  CommunicationPreferences,
  ConnectivityLevel,
  DisabilityCategory,
} from './ai-harness/types';

export interface RegisteredPatient {
  id: string;
  fullName: string;
  cedula: string;
  age: number;
  phone: string;
  supportContact: string;
  connectivity: ConnectivityLevel;
  disabilities: DisabilityCategory[];
  disabilityDetails: string;
  assistiveTech: string[];
  preferences: CommunicationPreferences;
  /** Apoyos habilitados según su discapacidad (RF-01, tabla del F4) */
  supports: SupportKey[];
  email?: string;
  consentAccepted: boolean;
  createdAt: string;
  aiAccessibilityBrief: AnalyzeAccessibilityNeedsOutput;
}

const PATIENTS_KEY = 'ssb_patients_v1';

function buildSeedPatients(): RegisteredPatient[] {
  const rawSeeds: Array<Omit<RegisteredPatient, 'aiAccessibilityBrief' | 'supports'>> = [
    {
      id: 'pac-001',
      fullName: 'María Fernanda López',
      cedula: '1314567890',
      age: 34,
      phone: '0991122334',
      supportContact: 'Luis López (Hermano) - 0987654321',
      connectivity: 'media',
      disabilities: ['auditiva'],
      disabilityDetails:
        'Sordera profunda bilateral desde la infancia. Se comunica principalmente en Lengua de Señas Ecuatoriana (LSEc) y lectura labial parcial.',
      assistiveTech: ['Lengua de Señas Ecuatoriana (LSEc)', 'Subtítulos en directo'],
      preferences: {
        subtitles: true,
        lsecInterpreter: true,
        ttsAudio: false,
        easyReadPictograms: false,
        highContrast: false,
        fontScale: 1,
        remindersVisual: true,
        remindersVibration: true,
        remindersAudio: false,
      },
      consentAccepted: true,
      createdAt: '2026-11-16T09:15:00.000Z',
    },
    {
      id: 'pac-002',
      fullName: 'Carlos Alberto Mendoza',
      cedula: '1308745123',
      age: 62,
      phone: '0984455667',
      supportContact: 'Ana Mendoza (Hija) - 0993344556',
      connectivity: 'media',
      disabilities: ['visual'],
      disabilityDetails:
        'Baja visión severa por glaucoma crónico. Utiliza lector de pantalla NVDA en Windows y ampliación tipográfica elevada.',
      assistiveTech: ['Lector de pantalla (NVDA / TalkBack)', 'Texto a voz (TTS)'],
      preferences: {
        subtitles: false,
        lsecInterpreter: false,
        ttsAudio: true,
        easyReadPictograms: false,
        highContrast: true,
        fontScale: 1.75,
        remindersVisual: true,
        remindersVibration: true,
        remindersAudio: true,
      },
      consentAccepted: true,
      createdAt: '2026-11-16T11:30:00.000Z',
    },
    {
      id: 'pac-003',
      fullName: 'Rosa Elena Zambrano',
      cedula: '1309988776',
      age: 51,
      phone: '0995566778',
      supportContact: 'Marta Zambrano (Cuidadora) - 0981122990',
      connectivity: 'baja',
      disabilities: ['motriz', 'cognitiva'],
      disabilityDetails:
        'Secuela motora en miembro superior derecho que impide uso fino del ratón y dificultad leve de memoria tras evento cerebrovascular.',
      assistiveTech: ['Teclado adaptado / Pulsador', 'Lectura Fácil con pictogramas'],
      preferences: {
        subtitles: true,
        lsecInterpreter: false,
        ttsAudio: true,
        easyReadPictograms: true,
        highContrast: false,
        fontScale: 1.25,
        remindersVisual: true,
        remindersVibration: true,
        remindersAudio: true,
      },
      consentAccepted: true,
      createdAt: '2026-11-17T08:10:00.000Z',
    },
  ];

  return rawSeeds.map((seed) => ({
    ...seed,
    supports: supportsFor(seed.disabilities),
    aiAccessibilityBrief: runDeterministicFallback('ANALYZE_ACCESSIBILITY_NEEDS', {
      patientName: seed.fullName,
      age: seed.age,
      disabilities: seed.disabilities,
      disabilityDetails: seed.disabilityDetails,
      assistiveTech: seed.assistiveTech,
      communicationPreferences: seed.preferences,
      connectivity: seed.connectivity,
    }),
  }));
}

function safeRead<T>(key: string, fallbackFactory: () => T): T {
  if (typeof window === 'undefined') return fallbackFactory();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const seed = fallbackFactory();
      window.localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallbackFactory();
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignorar error de almacenamiento
  }
}

export function getPatients(): RegisteredPatient[] {
  return safeRead<RegisteredPatient[]>(PATIENTS_KEY, buildSeedPatients);
}

export function getPatient(id: string): RegisteredPatient | undefined {
  const p = getPatients().find((x) => x.id === id);
  // Registros guardados antes de existir `supports` se completan con la tabla del F4.
  return p ? { ...p, supports: p.supports ?? supportsFor(p.disabilities) } : undefined;
}

export function addPatient(patient: RegisteredPatient): RegisteredPatient[] {
  const list = getPatients();
  const updated = [patient, ...list];
  safeWrite(PATIENTS_KEY, updated);
  return updated;
}

export function resetPatientsSeed(): RegisteredPatient[] {
  const seeds = buildSeedPatients();
  safeWrite(PATIENTS_KEY, seeds);
  return seeds;
}

export const DISABILITY_LABELS: Record<DisabilityCategory, string> = {
  auditiva: 'Auditiva (Sordera / Hipoacusia)',
  visual: 'Visual (Ceguera / Baja visión)',
  motriz: 'Motriz / Física',
  cognitiva: 'Cognitiva / Comprensión',
  habla: 'Del Habla / Comunicación verbal',
};
