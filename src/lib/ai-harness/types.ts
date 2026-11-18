/**
 * Tipos estrictos para el Harness de IA No Conversacional de SaludSinBarreras.
 * Este módulo define tareas cerradas, sin chat abierto ni memoria conversacional multi-turno.
 */

export type AITaskType =
  | 'ANALYZE_ACCESSIBILITY_NEEDS'
  | 'ORGANIZE_PATIENT_QUESTIONS'
  | 'SUMMARIZE_MEDICAL_INDICATIONS';

export type AIProviderName =
  | 'gemini'
  | 'openai'
  | 'ollama'
  | 'local-deterministic-fallback';

export type ApprovalStatus =
  | 'BORRADOR_IA_PENDIENTE'
  | 'APROBADO_POR_PROFESIONAL'
  | 'NO_REQUIERE_FIRMA';

export type DisabilityCategory =
  | 'auditiva'
  | 'visual'
  | 'motriz'
  | 'cognitiva'
  | 'habla';

export type PictogramType =
  | 'pastilla'
  | 'jarabe'
  | 'gotas'
  | 'inhalador'
  | 'inyeccion'
  | 'cuidado'
  | 'alerta';

export type ConnectivityLevel = 'baja' | 'media' | 'alta';

export interface CommunicationPreferences {
  subtitles: boolean;
  lsecInterpreter: boolean;
  ttsAudio: boolean;
  easyReadPictograms: boolean;
  highContrast: boolean;
  fontScale: number;
  remindersVisual: boolean;
  remindersVibration: boolean;
  remindersAudio: boolean;
}

export interface AnalyzeAccessibilityNeedsInput {
  patientName: string;
  age: number;
  disabilities: DisabilityCategory[];
  disabilityDetails: string;
  assistiveTech: string[];
  communicationPreferences: CommunicationPreferences;
  connectivity: ConnectivityLevel;
}

export interface AnalyzeAccessibilityNeedsOutput {
  summaryBanner: string;
  requiresExtraSessionTime: boolean;
  recommendedExtraMinutes: number;
  mandatorySupports: string[];
  professionalChecklist: string[];
  interpreterBriefing: string[];
  bandwidthRecommendation: string;
  appliedInterfacePreset: {
    fontScale: number;
    contrast: 'standard' | 'high';
    ttsAuto: boolean;
    easyRead: boolean;
    subtitlesDefault: boolean;
    visualAlerts: boolean;
  };
}

export interface OrganizePatientQuestionsInput {
  patientName: string;
  specialty: string;
  consultationReason: string;
  rawNotesAndDoubts: string;
  preferredInputMode: 'texto' | 'voz' | 'señas-lsec' | 'pulsador';
}

export interface OrganizedQuestionItem {
  priority: 'alta' | 'media' | 'baja';
  category: 'sintomas' | 'medicacion' | 'cuidados' | 'examenes';
  question: string;
  easyReadHint: string;
}

export interface OrganizePatientQuestionsOutput {
  chiefFocus: string;
  prioritizedQuestions: OrganizedQuestionItem[];
  suggestedClarificationsForDoctor: string[];
  ttsScript: string;
}

export interface SummarizeMedicalIndicationsInput {
  doctorName: string;
  patientName: string;
  consultationDate: string;
  clinicalNotes: string;
  transcriptText: string;
  targetFormat: {
    easyRead: boolean;
    includeAudioScript: boolean;
    includePictograms: boolean;
  };
}

export interface MedicationIndication {
  name: string;
  dosage: string;
  schedule: string;
  duration: string;
  pictogram: PictogramType;
  plainInstruction: string;
}

export interface SummarizeMedicalIndicationsOutput {
  easyReadSummary: string;
  medications: MedicationIndication[];
  careSteps: string[];
  warningSigns: string[];
  nextFollowUp: string;
  ttsAudioScript: string;
  accessibleTranscriptTxt: string;
}

export interface TaskInputMap {
  ANALYZE_ACCESSIBILITY_NEEDS: AnalyzeAccessibilityNeedsInput;
  ORGANIZE_PATIENT_QUESTIONS: OrganizePatientQuestionsInput;
  SUMMARIZE_MEDICAL_INDICATIONS: SummarizeMedicalIndicationsInput;
}

export interface TaskOutputMap {
  ANALYZE_ACCESSIBILITY_NEEDS: AnalyzeAccessibilityNeedsOutput;
  ORGANIZE_PATIENT_QUESTIONS: OrganizePatientQuestionsOutput;
  SUMMARIZE_MEDICAL_INDICATIONS: SummarizeMedicalIndicationsOutput;
}

export interface AIHarnessGuardrails {
  passed: boolean;
  blockedDiagnosticClaims: string[];
  requiresProfessionalApproval: boolean;
  disclaimer: string;
}

export interface AIHarnessApprovalState {
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
}

export interface AIHarnessConfig {
  provider?: AIProviderName;
  apiUrl?: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  fallbackOnError?: boolean;
}

export interface AIHarnessResult<T> {
  taskId: string;
  taskType: AITaskType;
  provider: AIProviderName;
  nonConversationalMode: true;
  guardrails: AIHarnessGuardrails;
  approvalState: AIHarnessApprovalState;
  data: T;
  latencyMs: number;
  timestamp: string;
  metadata?: {
    modelUsed?: string;
    fallbackReason?: string;
  };
}
