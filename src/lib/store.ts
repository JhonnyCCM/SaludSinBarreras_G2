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

export interface ProfessionalSchedule {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  startTime: string;
  baseMinutes: number;
  includesLsecExtraTime: boolean;
  totalMinutes: number;
  notes: string;
}

export interface InterpreterProfile {
  id: string;
  fullName: string;
  accreditationCode: string;
  validUntil: string;
  availabilityDays: string;
  timeWindow: string;
  verified: boolean;
  pendingRequest?: {
    id: string;
    patientName: string;
    doctorName: string;
    dateTime: string;
    specialty: string;
    status: 'PENDIENTE' | 'CONFIRMADA' | 'RECHAZADA';
  };
}

const PATIENTS_KEY = 'ssb_patients_v1';
const SCHEDULES_KEY = 'ssb_schedules_v1';
const INTERPRETERS_KEY = 'ssb_interpreters_v1';

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

const SEED_SCHEDULES: ProfessionalSchedule[] = [
  {
    id: 'sch-001',
    doctorName: 'Dra. Valeria Viteri',
    specialty: 'Medicina Familiar',
    date: '2026-11-19',
    startTime: '09:00',
    baseMinutes: 20,
    includesLsecExtraTime: true,
    totalMinutes: 35,
    notes: 'Bloque reservado con +15 min de holgura para interpretación LSEc (RF-08).',
  },
  {
    id: 'sch-002',
    doctorName: 'Dr. Andrés Cedeño',
    specialty: 'Neurología y Rehabilitación',
    date: '2026-11-20',
    startTime: '10:30',
    baseMinutes: 30,
    includesLsecExtraTime: false,
    totalMinutes: 30,
    notes: 'Consulta con apoyo de Lectura Fácil y control de medicación.',
  },
];

const SEED_INTERPRETERS: InterpreterProfile[] = [
  {
    id: 'int-001',
    fullName: 'Lic. Gabriela Intriago',
    accreditationCode: 'CONADIS-LSEC-0418',
    validUntil: '2027-08-30',
    availabilityDays: 'Lunes a Viernes',
    timeWindow: '08:00 - 14:00',
    verified: true,
    pendingRequest: {
      id: 'req-101',
      patientName: 'María Fernanda López',
      doctorName: 'Dra. Valeria Viteri',
      dateTime: '2026-11-19 09:00',
      specialty: 'Medicina Familiar',
      status: 'PENDIENTE',
    },
  },
  {
    id: 'int-002',
    fullName: 'Lic. Mateo Quintero',
    accreditationCode: 'CONADIS-LSEC-0792',
    validUntil: '2027-11-15',
    availabilityDays: 'Martes, Jueves y Sábados',
    timeWindow: '13:00 - 18:00',
    verified: true,
  },
];

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

export function getProfessionalSchedules(): ProfessionalSchedule[] {
  return safeRead<ProfessionalSchedule[]>(SCHEDULES_KEY, () => [...SEED_SCHEDULES]);
}

export function addProfessionalSchedule(
  schedule: ProfessionalSchedule
): ProfessionalSchedule[] {
  const list = getProfessionalSchedules();
  const updated = [schedule, ...list];
  safeWrite(SCHEDULES_KEY, updated);
  return updated;
}

export function getInterpreters(): InterpreterProfile[] {
  return safeRead<InterpreterProfile[]>(INTERPRETERS_KEY, () =>
    SEED_INTERPRETERS.map((item) => ({ ...item }))
  );
}

export function addInterpreter(interpreter: InterpreterProfile): InterpreterProfile[] {
  const list = getInterpreters();
  const updated = [interpreter, ...list];
  safeWrite(INTERPRETERS_KEY, updated);
  return updated;
}

export function updateInterpreterRequestStatus(
  interpreterId: string,
  status: 'CONFIRMADA' | 'RECHAZADA'
): InterpreterProfile[] {
  const list = getInterpreters();
  const updated = list.map((item) => {
    if (item.id === interpreterId && item.pendingRequest) {
      return {
        ...item,
        pendingRequest: {
          ...item.pendingRequest,
          status,
        },
      };
    }
    return item;
  });
  safeWrite(INTERPRETERS_KEY, updated);
  return updated;
}

export const DISABILITY_LABELS: Record<DisabilityCategory, string> = {
  auditiva: 'Auditiva (Sordera / Hipoacusia)',
  visual: 'Visual (Ceguera / Baja visión)',
  motriz: 'Motriz / Física',
  cognitiva: 'Cognitiva / Comprensión',
  habla: 'Del Habla / Comunicación verbal',
};
