import {
  MEDICAL_AI_DISCLAIMER,
  NonConversationalViolationError,
  approveHarnessResult,
  assertNonConversationalInput,
  sanitizeResultData,
  validateTaskInput,
} from './guardrails';
import {
  callExternalNonConversationalProvider,
  resolveRuntimeConfig,
  runDeterministicFallback,
  takeAgentBlockedClaims,
} from './providers';
import type {
  AIHarnessConfig,
  AIHarnessResult,
  AIProviderName,
  AITaskType,
  ApprovalStatus,
  TaskInputMap,
  TaskOutputMap,
} from './types';

export * from './types';
export {
  MEDICAL_AI_DISCLAIMER,
  NonConversationalViolationError,
  approveHarnessResult,
};

function generateTaskId(taskType: AITaskType): string {
  const prefix = taskType.slice(0, 4).toLowerCase();
  const rand = Math.random().toString(36).slice(2, 8);
  return `ssb-${prefix}-${Date.now().toString(36)}-${rand}`;
}

/**
 * Orquestador principal del Harness de IA No Conversacional.
 * Pipeline: validación de esquema -> bloqueo anti-chat -> ejecución de proveedor
 * (o fallback determinista local) -> sanitización de guardrails médicos -> sellado de aprobación.
 */
export async function executeAIHarnessTask<K extends AITaskType>(
  taskType: K,
  input: TaskInputMap[K],
  config?: AIHarnessConfig
): Promise<AIHarnessResult<TaskOutputMap[K]>> {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // 1. Verificación estricta no conversacional y validación de esquema
  assertNonConversationalInput(input);
  validateTaskInput(taskType, input);

  const resolvedConfig = resolveRuntimeConfig(config);
  let activeProvider: AIProviderName = resolvedConfig.provider;
  let fallbackReason: string | undefined;
  let rawData: TaskOutputMap[K];

  // 2. Ejecución del proveedor o fallback determinista local
  if (activeProvider === 'local-deterministic-fallback') {
    rawData = runDeterministicFallback(taskType, input);
  } else {
    try {
      rawData = await callExternalNonConversationalProvider(taskType, input, resolvedConfig);
    } catch (err) {
      if (!resolvedConfig.fallbackOnError) {
        throw err;
      }
      fallbackReason = err instanceof Error ? err.message : 'Error al consultar proveedor externo.';
      activeProvider = 'local-deterministic-fallback';
      rawData = runDeterministicFallback(taskType, input);
    }
  }

  // 3. Sanitización de guardrails médicos (sin diagnóstico autónomo ni prescripción sin firma)
  const sanitized = sanitizeResultData(rawData);
  const sanitizedData = sanitized.data;
  // Si respondió el agente Rust, sus frases bloqueadas se suman a las del guardrail local (sin repetir).
  const agentClaims = activeProvider === 'rust-agente' ? takeAgentBlockedClaims() : [];
  const blockedDiagnosticClaims = [...new Set([...agentClaims, ...sanitized.blockedDiagnosticClaims])];

  const requiresProfessionalApproval = taskType === 'SUMMARIZE_MEDICAL_INDICATIONS';
  const initialApprovalStatus: ApprovalStatus = requiresProfessionalApproval
    ? 'BORRADOR_IA_PENDIENTE'
    : 'NO_REQUIERE_FIRMA';

  const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const latencyMs = Math.max(1, Math.round(endedAt - startedAt));

  return {
    taskId: generateTaskId(taskType),
    taskType,
    provider: activeProvider,
    nonConversationalMode: true,
    guardrails: {
      passed: blockedDiagnosticClaims.length === 0,
      blockedDiagnosticClaims,
      requiresProfessionalApproval,
      disclaimer: MEDICAL_AI_DISCLAIMER,
    },
    approvalState: {
      status: initialApprovalStatus,
    },
    data: sanitizedData,
    latencyMs,
    timestamp: new Date().toISOString(),
    metadata: {
      modelUsed: activeProvider === 'local-deterministic-fallback' ? 'deterministic-v1' : resolvedConfig.model,
      fallbackReason,
    },
  };
}
