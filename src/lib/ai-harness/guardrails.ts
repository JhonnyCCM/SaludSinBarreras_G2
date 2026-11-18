import type {
  AIHarnessResult,
  AITaskType,
  TaskInputMap,
} from './types';

export const MEDICAL_AI_DISCLAIMER =
  'Salida generada por componente de IA no conversacional de apoyo. No diagnostica ni prescribe. Todo resumen clínico requiere revisión y firma del profesional de salud (RF-14 / RNFU-05).';

const FORBIDDEN_CONVERSATIONAL_KEYS = new Set([
  'messages',
  'chatHistory',
  'conversation',
  'conversationHistory',
  'history',
  'thread',
  'threadId',
  'freeformPrompt',
  'systemPromptOverride',
]);

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /olvida\s+las\s+instrucciones/i,
  /act[uú]a\s+como\s+(un\s+)?(chat|m[eé]dico|doctor)\s+libre/i,
  /responde\s+en\s+modo\s+conversacional/i,
];

const DIAGNOSTIC_OR_PRESCRIPTION_PATTERNS: RegExp[] = [
  /\busted\s+(padece|tiene\s+confirmado|sufre\s+de)\b[^.:\n]*/gi,
  /\bsu\s+diagn[oó]stico\s+(es|definitivo\s+es)\b[^.:\n]*/gi,
  /\ble\s+(diagnostico|receto|prescribo)\b[^.:\n]*/gi,
  /\bdiagn[oó]stico\s+confirmado\s+por\s+ia\b[^.:\n]*/gi,
  /\bsuspenda\s+su\s+tratamiento\s+sin\s+consultar\b[^.:\n]*/gi,
  /\btome\s+sin\s+receta\b[^.:\n]*/gi,
];

export class NonConversationalViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonConversationalViolationError';
  }
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      collectStrings(v, out);
    }
  }
  return out;
}

/**
 * Garantiza que el payload corresponda a una invocación estructurada de tarea única,
 * bloqueando historiales de chat multi-turno o prompts abiertos.
 */
export function assertNonConversationalInput(payload: unknown): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NonConversationalViolationError(
      'El harness no conversacional exige un objeto de entrada estructurado.'
    );
  }

  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_CONVERSATIONAL_KEYS.has(key)) {
      throw new NonConversationalViolationError(
        `Propiedad conversacional prohibida detectada: "${key}". Este harness opera exclusivamente en modo de tarea única sin chat.`
      );
    }
  }

  const allTexts = collectStrings(payload);
  for (const text of allTexts) {
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        throw new NonConversationalViolationError(
          'Entrada bloqueada por guardrail: intento de desvío hacia modo conversacional abierto.'
        );
      }
    }
  }
}

/**
 * Valida campos mínimos requeridos según el tipo de tarea cerrada.
 */
export function validateTaskInput<K extends AITaskType>(
  taskType: K,
  input: TaskInputMap[K]
): void {
  if (taskType === 'ANALYZE_ACCESSIBILITY_NEEDS') {
    const data = input as TaskInputMap['ANALYZE_ACCESSIBILITY_NEEDS'];
    if (!data.patientName?.trim()) {
      throw new NonConversationalViolationError(
        'Falta patientName para ANALYZE_ACCESSIBILITY_NEEDS.'
      );
    }
    if (!Array.isArray(data.disabilities) || data.disabilities.length === 0) {
      throw new NonConversationalViolationError(
        'Debe indicarse al menos una categoría en disabilities.'
      );
    }
  }

  if (taskType === 'ORGANIZE_PATIENT_QUESTIONS') {
    const data = input as TaskInputMap['ORGANIZE_PATIENT_QUESTIONS'];
    if (!data.rawNotesAndDoubts?.trim()) {
      throw new NonConversationalViolationError(
        'Debe ingresar notas o dudas del paciente para organizarlas.'
      );
    }
  }

  if (taskType === 'SUMMARIZE_MEDICAL_INDICATIONS') {
    const data = input as TaskInputMap['SUMMARIZE_MEDICAL_INDICATIONS'];
    if (!data.doctorName?.trim() || !data.patientName?.trim()) {
      throw new NonConversationalViolationError(
        'Se requiere doctorName y patientName para resumir indicaciones clínicas.'
      );
    }
    if (!data.clinicalNotes?.trim() && !data.transcriptText?.trim()) {
      throw new NonConversationalViolationError(
        'Debe proporcionar notas clínicas o transcripción para generar el borrador.'
      );
    }
  }
}

/**
 * Detecta y neutraliza afirmaciones que simulen diagnóstico médico autónomo
 * o prescripción sin intervención humana.
 */
export function sanitizeMedicalOutput(text: string): {
  sanitized: string;
  blockedClaims: string[];
} {
  let sanitized = text;
  const blockedClaims: string[] = [];

  for (const pattern of DIAGNOSTIC_OR_PRESCRIPTION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    sanitized = sanitized.replace(regex, (match) => {
      blockedClaims.push(match.trim());
      return '[Frase clínica bloqueada por guardrail: requiere validación directa del profesional de salud]';
    });
  }

  return { sanitized, blockedClaims };
}

/**
 * Recorre recursivamente cualquier estructura JSON generada por la IA y aplica
 * los guardrails médicos sobre todas las cadenas de texto.
 */
export function sanitizeResultData<T>(data: T): {
  data: T;
  blockedDiagnosticClaims: string[];
} {
  const blockedDiagnosticClaims: string[] = [];

  function walk(node: unknown): unknown {
    if (typeof node === 'string') {
      const { sanitized, blockedClaims } = sanitizeMedicalOutput(node);
      if (blockedClaims.length > 0) {
        blockedDiagnosticClaims.push(...blockedClaims);
      }
      return sanitized;
    }
    if (Array.isArray(node)) {
      return node.map((item) => walk(item));
    }
    if (node && typeof node === 'object') {
      const clone: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(node)) {
        clone[key] = walk(val);
      }
      return clone;
    }
    return node;
  }

  return {
    data: walk(data) as T,
    blockedDiagnosticClaims,
  };
}

/**
 * Sella y aprueba digitalmente un resultado generado por IA cuando requiere
 * validación del profesional de salud (RF-14 / RNFU-05).
 */
export function approveHarnessResult<T>(
  result: AIHarnessResult<T>,
  professionalName: string,
  editedData?: Partial<T>
): AIHarnessResult<T> {
  const cleanName = professionalName.trim();
  if (!cleanName) {
    throw new Error('Se requiere el nombre del profesional de salud para firmar y aprobar.');
  }

  const mergedData =
    editedData && typeof result.data === 'object' && result.data !== null
      ? { ...result.data, ...editedData }
      : result.data;

  const sanitized = sanitizeResultData(mergedData);

  return {
    ...result,
    data: sanitized.data,
    guardrails: {
      ...result.guardrails,
      blockedDiagnosticClaims: [
        ...result.guardrails.blockedDiagnosticClaims,
        ...sanitized.blockedDiagnosticClaims,
      ],
    },
    approvalState: {
      status: 'APROBADO_POR_PROFESIONAL',
      approvedBy: cleanName,
      approvedAt: new Date().toISOString(),
    },
  };
}
