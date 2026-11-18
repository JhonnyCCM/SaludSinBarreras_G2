/**
 * Contenido de la consulta.
 * RF-04 preguntas del paciente (texto, voz o señas) · RF-13 el profesional las marca como respondidas
 * RF-07 transcripción descargable · RF-14 borrador IA firmado · RF-05 el paciente ve solo lo firmado.
 */
import type { OrganizedQuestionItem, SummarizeMedicalIndicationsOutput } from '../ai-harness/types';
import { collection, isoDate, uid } from './db';
import { notify } from './notifications';

export type QuestionMode = 'texto' | 'voz' | 'señas';

export interface Question {
  id: string;
  appointmentId: string;
  text: string;
  mode: QuestionMode;
  createdAt: string;
  priority?: OrganizedQuestionItem['priority'];
  category?: OrganizedQuestionItem['category'];
  answered: boolean;
}

export interface TranscriptLine {
  at: string;
  speaker: string;
  text: string;
}

export interface Transcript {
  id: string; // = appointmentId
  lines: TranscriptLine[];
}

export interface ConsultSummary {
  id: string; // = appointmentId
  patientId: string;
  status: 'BORRADOR' | 'FIRMADO';
  data: SummarizeMedicalIndicationsOutput;
  provider: string;
  signedBy?: string;
  signedAt?: string;
}

export const questions = collection<Question>('questions', () => [
  { id: 'q-001', appointmentId: 'apt-001', text: '¿Puedo seguir trabajando mientras tengo fiebre?', mode: 'texto', createdAt: new Date().toISOString(), answered: false },
  { id: 'q-002', appointmentId: 'apt-001', text: '¿El jarabe se toma antes o después de comer?', mode: 'señas', createdAt: new Date().toISOString(), answered: false },
]);

const PAST_TRANSCRIPT: TranscriptLine[] = [
  { at: `${isoDate(-7)}T10:02:00`, speaker: 'Dra. Valeria Viteri', text: 'Buenos días, don Carlos. ¿Cómo ha estado su presión esta semana?' },
  { at: `${isoDate(-7)}T10:03:00`, speaker: 'Carlos Alberto Mendoza', text: 'Bien, doctora, pero a veces se me olvidan las gotas de la noche.' },
  { at: `${isoDate(-7)}T10:05:00`, speaker: 'Dra. Valeria Viteri', text: 'Continuamos con losartán 50 mg cada mañana y las gotas de timolol cada 12 horas. Le activaré recordatorios.' },
  { at: `${isoDate(-7)}T10:07:00`, speaker: 'Dra. Valeria Viteri', text: 'Si tiene dolor intenso en el ojo o visión borrosa repentina, acuda a urgencias. Nos vemos en 15 días.' },
];

export const transcripts = collection<Transcript>('transcripts', () => [{ id: 'apt-000', lines: PAST_TRANSCRIPT }]);

export const summaries = collection<ConsultSummary>('summaries', () => [
  {
    id: 'apt-000',
    patientId: 'pac-002',
    status: 'FIRMADO',
    provider: 'local-deterministic-fallback',
    signedBy: 'Dra. Valeria Viteri — MSP-130982',
    signedAt: `${isoDate(-7)}T10:25:00`,
    data: {
      easyReadSummary: 'Siga tomando su pastilla para la presión cada mañana y use sus gotas en los ojos cada 12 horas. Coma con poca sal.',
      medications: [
        { name: 'Losartán', dosage: '50 mg', schedule: 'Cada 24 horas, en la mañana', duration: '30 días', pictogram: 'pastilla', plainInstruction: 'Tome 1 pastilla cada mañana con agua.' },
        { name: 'Timolol 0,5 %', dosage: '1 gota en cada ojo', schedule: 'Cada 12 horas', duration: '30 días', pictogram: 'gotas', plainInstruction: 'Ponga 1 gota en cada ojo en la mañana y en la noche.' },
      ],
      careSteps: ['Mida su presión 2 veces por semana.', 'Coma con poca sal.'],
      warningSigns: ['Dolor fuerte en el ojo.', 'Visión borrosa de repente.'],
      nextFollowUp: 'Control en 15 días.',
      ttsAudioScript: 'Siga tomando su pastilla para la presión cada mañana y use sus gotas cada 12 horas.',
      accessibleTranscriptTxt: '',
    },
  },
]);

// ---------- Preguntas ----------
export const questionsOf = (appointmentId: string) =>
  questions.where((q) => q.appointmentId === appointmentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export function addQuestion(appointmentId: string, text: string, mode: QuestionMode): Question {
  return questions.insert({ id: uid('q'), appointmentId, text, mode, createdAt: new Date().toISOString(), answered: false });
}

export const setAnswered = (id: string, answered: boolean) => questions.update(id, { answered });

// ---------- Transcripción ----------
export function appendTranscript(appointmentId: string, speaker: string, text: string): void {
  const line = { at: new Date().toISOString(), speaker, text };
  if (transcripts.get(appointmentId)) transcripts.update(appointmentId, (t) => ({ lines: [...t.lines, line] }));
  else transcripts.insert({ id: appointmentId, lines: [line] });
}

export function transcriptText(appointmentId: string): string {
  const t = transcripts.get(appointmentId);
  if (!t) return '';
  return t.lines
    .map((l) => `[${new Date(l.at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}] ${l.speaker}: ${l.text}`)
    .join('\n');
}

// ---------- Resumen ----------
export function saveDraft(appointmentId: string, patientId: string, data: SummarizeMedicalIndicationsOutput, provider: string): void {
  const draft: ConsultSummary = { id: appointmentId, patientId, status: 'BORRADOR', data, provider };
  if (summaries.get(appointmentId)) summaries.update(appointmentId, draft);
  else summaries.insert(draft);
}

export function signSummary(appointmentId: string, signer: string, data: SummarizeMedicalIndicationsOutput): void {
  const s = summaries.update(appointmentId, { status: 'FIRMADO', data, signedBy: signer, signedAt: new Date().toISOString() });
  if (s) notify('paciente', s.patientId, 'Tu médico firmó el resumen de indicaciones. Ya puedes consultarlo.');
}

/** RF-05: el paciente solo recibe resúmenes firmados. */
export const signedSummariesOf = (patientId: string) =>
  summaries.where((s) => s.patientId === patientId && s.status === 'FIRMADO').sort((a, b) => (b.signedAt ?? '').localeCompare(a.signedAt ?? ''));
