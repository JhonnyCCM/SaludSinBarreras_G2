import type {
  AIHarnessConfig,
  AIProviderName,
  AITaskType,
  AnalyzeAccessibilityNeedsInput,
  AnalyzeAccessibilityNeedsOutput,
  MedicationIndication,
  OrganizePatientQuestionsInput,
  OrganizePatientQuestionsOutput,
  OrganizedQuestionItem,
  PictogramType,
  SummarizeMedicalIndicationsInput,
  SummarizeMedicalIndicationsOutput,
  TaskInputMap,
  TaskOutputMap,
} from './types';

function readEnv(key: string): string {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    if (meta?.env && typeof meta.env[key] === 'string') {
      return meta.env[key] as string;
    }
  } catch {
    // Entorno sin import.meta.env
  }
  return '';
}

/** URL del agente Rust no conversacional (backend/agente-ia). */
export function agentBaseUrl(): string {
  return (readEnv('PUBLIC_AGENTE_URL') || 'http://127.0.0.1:8787').replace(/\/$/, '');
}

const TASK_PATHS: Record<AITaskType, string> = {
  ANALYZE_ACCESSIBILITY_NEEDS: 'analizar-necesidades',
  ORGANIZE_PATIENT_QUESTIONS: 'organizar-preguntas',
  SUMMARIZE_MEDICAL_INDICATIONS: 'resumir-indicaciones',
};

/** Si el agente no responde, se evita reintentar durante 30 s para no demorar la interfaz. */
let agentDownUntil = 0;

/** Frases que el guardrail del agente Rust bloqueó en la última respuesta (los datos ya llegan saneados). */
let lastAgentBlockedClaims: string[] = [];
export function takeAgentBlockedClaims(): string[] {
  const claims = lastAgentBlockedClaims;
  lastAgentBlockedClaims = [];
  return claims;
}

export function resolveRuntimeConfig(overrides?: AIHarnessConfig): Required<AIHarnessConfig> {
  const envProvider = readEnv('PUBLIC_AI_PROVIDER') as AIProviderName | '';
  // Por defecto se usa el agente Rust; si no está encendido, el harness cae al motor local.
  const provider: AIProviderName = overrides?.provider || envProvider || 'rust-agente';

  return {
    provider,
    apiUrl: overrides?.apiUrl || readEnv('PUBLIC_AI_API_URL'),
    model: overrides?.model || readEnv('PUBLIC_AI_MODEL') || defaultModelFor(provider),
    apiKey: overrides?.apiKey || readEnv('PUBLIC_AI_API_KEY') || readEnv('AI_API_KEY'),
    timeoutMs: overrides?.timeoutMs ?? (provider === 'rust-agente' ? 2500 : 12000),
    fallbackOnError: overrides?.fallbackOnError ?? true,
  };
}

function defaultModelFor(provider: AIProviderName): string {
  switch (provider) {
    case 'gemini':
      return 'gemini-2.5-flash';
    case 'openai':
      return 'gpt-4o-mini';
    case 'ollama':
      return 'llama3.1';
    case 'rust-agente':
      return 'agente-rust-determinista-v1';
    default:
      return 'deterministic-v1';
  }
}

const SYSTEM_INSTRUCTIONS_BY_TASK: Record<AITaskType, string> = {
  ANALYZE_ACCESSIBILITY_NEEDS:
    'Eres un módulo no conversacional de SaludSinBarreras. Recibes datos estructurados de discapacidad de un paciente y devuelves ÚNICAMENTE JSON válido con apoyos de telemedicina WCAG 2.2. Prohibido conversar, saludar o diagnosticar.',
  ORGANIZE_PATIENT_QUESTIONS:
    'Eres un módulo no conversacional de SaludSinBarreras. Transformas notas de un paciente en una lista priorizada de preguntas claras para su cita médica en JSON válido. Prohibido diagnosticar, recomendar medicamentos o responder como chat.',
  SUMMARIZE_MEDICAL_INDICATIONS:
    'Eres un módulo no conversacional de SaludSinBarreras. Conviertes notas clínicas del médico y transcripción en un borrador estructurado de lectura fácil con pictogramas permitidos (pastilla, jarabe, gotas, inhalador, inyeccion, cuidado, alerta) en JSON válido. Prohibido inventar dosis, diagnosticar o emitir recetas definitivas sin firma médica.',
};

function inferPictogram(line: string): PictogramType {
  const lower = line.toLowerCase();
  if (/jarabe|ml|cucharada|suspensi[oó]n/.test(lower)) return 'jarabe';
  if (/gotas|colirio|oft[aá]lmic|ótic/.test(lower)) return 'gotas';
  if (/inhalador|puff|spray|nebuliz/.test(lower)) return 'inhalador';
  if (/inyec|ampolla|insulina|subcut[aá]ne/.test(lower)) return 'inyeccion';
  if (/alerta|urgencia|fiebre|emergencia/.test(lower)) return 'alerta';
  if (/reposo|agua|dieta|control|medir|caminar|ejercicio/.test(lower)) return 'cuidado';
  return 'pastilla';
}

function runDeterministicAccessibility(
  input: AnalyzeAccessibilityNeedsInput
): AnalyzeAccessibilityNeedsOutput {
  const supports = new Set<string>();
  const checklist = new Set<string>();
  const interpreterBriefing: string[] = [];

  const hasAuditiva = input.disabilities.includes('auditiva');
  const hasVisual = input.disabilities.includes('visual');
  const hasMotriz = input.disabilities.includes('motriz');
  const hasCognitiva = input.disabilities.includes('cognitiva');
  const hasHabla = input.disabilities.includes('habla');

  const needsLsec = hasAuditiva || input.communicationPreferences.lsecInterpreter;
  const needsSubtitles = hasAuditiva || input.communicationPreferences.subtitles;
  const needsTts = hasVisual || input.communicationPreferences.ttsAudio;
  const needsEasyRead = hasCognitiva || input.communicationPreferences.easyReadPictograms;

  if (needsSubtitles) {
    supports.add('Subtítulos automáticos en tiempo real activos al entrar a sala (RF-03).');
  }
  if (needsLsec) {
    supports.add('Intérprete de Lengua de Señas Ecuatoriana (LSEc) en ventana fija y prioritaria (F3 · WCAG 1.2.6).');
    checklist.add('Hablar de frente a la cámara, ritmo pausado y respetando turnos con el intérprete.');
    interpreterBriefing.push(
      `Paciente ${input.patientName} requiere interpretación LSEc continua.`,
      'Mantener cámara con iluminación frontal, fondo liso y manos visibles en todo momento.',
      `Tecnologías reportadas: ${input.assistiveTech.join(', ') || 'Lengua de Señas Ecuatoriana (LSEc)'}.`
    );
  } else {
    interpreterBriefing.push('No requiere intérprete LSEc para esta ficha; mantener canal de respaldo disponible.');
  }

  if (hasVisual) {
    supports.add('Lectura por voz (TTS) compatible con lector de pantalla y alto contraste WCAG AA/AAA.');
    checklist.add('Describir verbalmente cualquier indicación visual, dosis o documento compartido.');
  }
  if (hasMotriz) {
    supports.add('Interfaz 100% operable por teclado o pulsadores con objetivos táctiles >= 44x44 px.');
    checklist.add('Evitar límites de tiempo estrictos y permitir confirmaciones paso a paso.');
  }
  if (needsEasyRead) {
    supports.add('Resumen de indicaciones en Lectura Fácil con listas cortas y pictogramas (RF-05).');
    checklist.add('Usar lenguaje cotidiano sin jerga médica y confirmar comprensión al cierre.');
  }
  if (hasHabla) {
    supports.add('Chat accesible y botón de turno de palabra sin exigir interacción por voz.');
    checklist.add('Dar tiempo suficiente para que el paciente escriba o utilice su comunicador alternativo.');
  }

  if (
    input.communicationPreferences.remindersVisual ||
    input.communicationPreferences.remindersVibration ||
    input.communicationPreferences.remindersAudio
  ) {
    const channels = [
      input.communicationPreferences.remindersVisual ? 'visual' : '',
      input.communicationPreferences.remindersVibration ? 'vibración' : '',
      input.communicationPreferences.remindersAudio ? 'sonoro' : '',
    ].filter(Boolean);
    supports.add(`Recordatorios multimodales habilitados (${channels.join(' + ')}) (RF-06).`);
  }

  checklist.add('Verificar que el borrador de indicaciones IA sea revisado y firmado antes de enviarlo (RF-14).');

  const extraMinutes = needsLsec ? 15 : hasCognitiva || hasHabla ? 10 : 0;
  const bandwidthRecommendation =
    input.connectivity === 'baja'
      ? 'Conectividad baja reportada: activar modo de ahorro de ancho de banda manteniendo prioridad en subtítulos y audio.'
      : input.connectivity === 'media'
        ? 'Conectividad media: habilitar video estándar adaptativo y respaldo de subtítulos sincrónicos.'
        : 'Conectividad alta: calidad HD habilitada para video de consulta e intérprete LSEc.';

  const contrast: 'standard' | 'high' = input.communicationPreferences.highContrast
    ? 'high'
    : 'standard';

  const fontScale = Math.min(
    2,
    Math.max(1, input.communicationPreferences.fontScale || (hasVisual ? 1.5 : 1))
  );

  return {
    summaryBanner: `${input.patientName} (${input.age} años) — Discapacidad: ${input.disabilities.join(', ').toUpperCase()}. ${
      extraMinutes > 0
        ? `Reservar +${extraMinutes} min adicionales en agenda.`
        : 'Duración estándar de consulta con apoyos activos.'
    }`,
    requiresExtraSessionTime: extraMinutes > 0,
    recommendedExtraMinutes: extraMinutes,
    mandatorySupports: Array.from(supports),
    professionalChecklist: Array.from(checklist),
    interpreterBriefing,
    bandwidthRecommendation,
    appliedInterfacePreset: {
      fontScale,
      contrast,
      ttsAuto: needsTts,
      easyRead: needsEasyRead,
      subtitlesDefault: needsSubtitles,
      visualAlerts: input.communicationPreferences.remindersVisual || hasAuditiva,
    },
  };
}

function runDeterministicQuestions(
  input: OrganizePatientQuestionsInput
): OrganizePatientQuestionsOutput {
  const fragments = input.rawNotesAndDoubts
    .split(/[\n.;?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const prioritizedQuestions: OrganizedQuestionItem[] = fragments.slice(0, 6).map((frag, idx) => {
    const lower = frag.toLowerCase();
    let category: OrganizedQuestionItem['category'] = 'sintomas';
    let priority: OrganizedQuestionItem['priority'] = idx === 0 ? 'alta' : 'media';

    if (/pastilla|medic|dosis|jarabe|tomar|remedio|receta/.test(lower)) {
      category = 'medicacion';
      priority = 'alta';
    } else if (/examen|an[aá]lisis|sangre|resultado|rayos|eco/.test(lower)) {
      category = 'examenes';
    } else if (/comer|agua|ejercicio|reposo|dormir|cuidado/.test(lower)) {
      category = 'cuidados';
      priority = 'baja';
    }

    if (/dolor|fiebre|mareo|falta de aire|presi[oó]n|urgente/.test(lower)) {
      priority = 'alta';
    }

    const cleanQuestion = frag.endsWith('?') ? frag : `¿${frag.charAt(0).toUpperCase()}${frag.slice(1)}?`;

    return {
      priority,
      category,
      question: cleanQuestion,
      easyReadHint: `Punto ${idx + 1} (${category}): expresar con calma al profesional durante la consulta.`,
    };
  });

  if (prioritizedQuestions.length === 0) {
    prioritizedQuestions.push({
      priority: 'alta',
      category: 'sintomas',
      question: `¿Qué debo vigilar respecto a: ${input.consultationReason || 'mi motivo de consulta'}?`,
      easyReadHint: 'Pregunta principal para iniciar la teleconsulta.',
    });
  }

  const ttsScript = `Preguntas organizadas para ${input.patientName} en ${input.specialty}. ${prioritizedQuestions
    .map((q, i) => `Pregunta ${i + 1}, prioridad ${q.priority}: ${q.question}`)
    .join(' ')}`;

  return {
    chiefFocus: `Consulta de ${input.specialty} — Motivo reportado: ${input.consultationReason || 'Seguimiento general'} (Modalidad: ${input.preferredInputMode}).`,
    prioritizedQuestions,
    suggestedClarificationsForDoctor: [
      `Confirmar desde cuándo presenta las molestias descritas por ${input.patientName}.`,
      'Validar si está tomando medicación previa o suplementos actuales.',
      'Confirmar comprensión de pasos siguientes usando el canal preferido del paciente.',
    ],
    ttsScript,
  };
}

function runDeterministicSummary(
  input: SummarizeMedicalIndicationsInput
): SummarizeMedicalIndicationsOutput {
  // Igual que el agente Rust: las notas mandan; la transcripción solo si no hay notas y sin "[hora] Hablante:".
  const combinedSource = (
    input.clinicalNotes.trim() ? input.clinicalNotes : input.transcriptText.replace(/^\s*(\[[^\]]*\]\s*)?[^:\n]{2,60}:\s*/gm, '')
  ).trim();
  const lines = combinedSource
    .split(/[\n.;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  const medications: MedicationIndication[] = [];
  const careSteps: string[] = [];
  const warningSigns: string[] = [];
  let nextFollowUp = 'Control de seguimiento según fecha acordada con el profesional de salud.';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/control|pr[oó]xima cita|regresar|revisi[oó]n en|d[ií]as/.test(lower) && !/cada \d+ horas/.test(lower)) {
      if (nextFollowUp.startsWith('Control de seguimiento según')) {
        nextFollowUp = line;
      }
    }

    if (
      /alarma|urgencia|emergencia|si presenta|acudir de inmediato|fiebre alta|dificultad para respirar/.test(
        lower
      )
    ) {
      warningSigns.push(line);
      continue;
    }

    if (
      /\d+\s*(mg|ml|gotas|puff|ui|c[aá]psula|tableta|comprimido)/i.test(line) ||
      /cada\s+\d+\s*horas/i.test(lower) ||
      /tomar|aplicar|inhalar/.test(lower)
    ) {
      const scheduleMatch = line.match(/cada\s+\d+\s*(horas|h|d[ií]as)|en la (mañana|noche)|desayuno|almuerzo|cena/i);
      const durationMatch = line.match(/por\s+\d+\s*(d[ií]as|semanas|meses)/i);
      const dosageMatch = line.match(/\d+\s*(mg|ml|gotas|puff|ui|tableta[s]?|c[aá]psula[s]?)/i);
      const cleanName = line.split(/[,:-]/)[0].trim().slice(0, 60);

      medications.push({
        name: cleanName || 'Indicación farmacológica registrada por el médico',
        dosage: dosageMatch ? dosageMatch[0] : 'Según indicación escrita del profesional',
        schedule: scheduleMatch ? scheduleMatch[0] : 'Según horario definido en consulta',
        duration: durationMatch ? durationMatch[0] : 'Hasta próximo control',
        pictogram: inferPictogram(line),
        plainInstruction: line,
      });
      continue;
    }

    careSteps.push(line);
  }

  if (medications.length === 0) {
    careSteps.unshift('No se detectaron fármacos específicos en las notas; seguir las indicaciones generales validadas por su médico.');
  }

  if (warningSigns.length === 0) {
    warningSigns.push(
      'Fiebre persistente mayor a 38.5 °C, dificultad para respirar o empeoramiento súbito de los síntomas: acudir a urgencias o contactar al centro de salud.'
    );
  }

  const normalizedCares = careSteps.length > 0 ? careSteps.slice(0, 6) : ['Mantener hidratación adecuada y reposo relativo según tolerancia.'];

  const easyReadSummary = input.targetFormat.easyRead
    ? `Hola ${input.patientName}. El profesional ${input.doctorName} revisó su consulta del ${input.consultationDate}. Siga paso a paso las indicaciones aprobadas abajo. Este resumen explica sus cuidados de forma sencilla y no reemplaza una emergencia médica.`
    : `Resumen estructurado de la atención realizada por ${input.doctorName} el ${input.consultationDate} para ${input.patientName}.`;

  const ttsAudioScript = input.targetFormat.includeAudioScript
    ? `${easyReadSummary} ${
        medications.length > 0
          ? `Indicaciones de medicación: ${medications
              .map((m, idx) => `Número ${idx + 1}: ${m.plainInstruction}.`)
              .join(' ')}`
          : ''
      } Cuidados diarios: ${normalizedCares.join('. ')}. Señales de alarma: ${warningSigns.join('. ')}. Próximo paso: ${nextFollowUp}.`
    : '';

  const accessibleTranscriptTxt = [
    'SALUDSINBARRERAS — TRANSCRIPCIÓN ACCESIBLE DE TELECONSULTA (RF-07)',
    `Fecha: ${input.consultationDate}`,
    `Paciente: ${input.patientName}`,
    `Profesional de salud: ${input.doctorName}`,
    '------------------------------------------------------------',
    'NOTAS CLÍNICAS ORIGINALES:',
    input.clinicalNotes || '(Sin notas adicionales)',
    '',
    'TRANSCRIPCIÓN DE LA CONSULTA:',
    input.transcriptText || '(Sin transcripción adjunta)',
    '------------------------------------------------------------',
    'NOTA DE SEGURIDAD: Documento generado con apoyo de IA no conversacional; válido únicamente tras revisión y firma del profesional de salud.',
  ].join('\n');

  return {
    easyReadSummary,
    medications,
    careSteps: normalizedCares,
    warningSigns,
    nextFollowUp,
    ttsAudioScript,
    accessibleTranscriptTxt,
  };
}

export function runDeterministicFallback<K extends AITaskType>(
  taskType: K,
  input: TaskInputMap[K]
): TaskOutputMap[K] {
  switch (taskType) {
    case 'ANALYZE_ACCESSIBILITY_NEEDS':
      return runDeterministicAccessibility(
        input as AnalyzeAccessibilityNeedsInput
      ) as TaskOutputMap[K];
    case 'ORGANIZE_PATIENT_QUESTIONS':
      return runDeterministicQuestions(
        input as OrganizePatientQuestionsInput
      ) as TaskOutputMap[K];
    case 'SUMMARIZE_MEDICAL_INDICATIONS':
      return runDeterministicSummary(
        input as SummarizeMedicalIndicationsInput
      ) as TaskOutputMap[K];
  }
}

/**
 * Ejecuta una petición única (single-shot) no conversacional contra Gemini, OpenAI u Ollama
 * exigiendo respuesta en JSON puro con temperatura 0.1.
 */
export async function callExternalNonConversationalProvider<K extends AITaskType>(
  taskType: K,
  input: TaskInputMap[K],
  config: Required<AIHarnessConfig>
): Promise<TaskOutputMap[K]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  const systemInstruction = SYSTEM_INSTRUCTIONS_BY_TASK[taskType];
  const userPayload = JSON.stringify({
    taskType,
    mode: 'NON_CONVERSATIONAL_SINGLE_SHOT',
    input,
  });

  try {
    if (config.provider === 'rust-agente') {
      if (Date.now() < agentDownUntil) throw new Error('Agente Rust no disponible (reintento en unos segundos).');
      try {
        const res = await fetch(`${config.apiUrl || agentBaseUrl()}/v1/tareas/${TASK_PATHS[taskType]}`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const json = (await res.json()) as { data?: TaskOutputMap[K]; error?: string; guardrails?: { blockedDiagnosticClaims?: string[] } };
        if (!res.ok || !json.data) throw new Error(json.error || `Agente Rust HTTP ${res.status}`);
        lastAgentBlockedClaims = json.guardrails?.blockedDiagnosticClaims ?? [];
        return json.data;
      } catch (err) {
        if (!(err instanceof Error && err.message.startsWith('Agente Rust HTTP'))) agentDownUntil = Date.now() + 30_000;
        throw err;
      }
    }

    if (config.provider === 'gemini') {
      if (!config.apiKey) {
        throw new Error('Falta API key para proveedor Gemini.');
      }
      const endpoint =
        config.apiUrl ||
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPayload }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });
      if (!res.ok) {
        throw new Error(`Error Gemini HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Respuesta vacía de Gemini.');
      return JSON.parse(text) as TaskOutputMap[K];
    }

    if (config.provider === 'openai') {
      if (!config.apiKey) {
        throw new Error('Falta API key para proveedor OpenAI compatible.');
      }
      const endpoint = config.apiUrl || 'https://api.openai.com/v1/chat/completions';
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPayload },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`Error OpenAI HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error('Respuesta vacía de OpenAI.');
      return JSON.parse(text) as TaskOutputMap[K];
    }

    if (config.provider === 'ollama') {
      const endpoint = config.apiUrl || 'http://localhost:11434/api/generate';
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          system: systemInstruction,
          prompt: userPayload,
          stream: false,
          format: 'json',
          options: { temperature: 0.1 },
        }),
      });
      if (!res.ok) {
        throw new Error(`Error Ollama HTTP ${res.status}`);
      }
      const json = (await res.json()) as { response?: string };
      if (!json.response) throw new Error('Respuesta vacía de Ollama.');
      return JSON.parse(json.response) as TaskOutputMap[K];
    }

    return runDeterministicFallback(taskType, input);
  } finally {
    clearTimeout(timer);
  }
}
