/**
 * Glosario de términos médicos por especialidad para preparar la interpretación (RF-20).
 * Cada término incluye una explicación sencilla y la glosa LSEc sugerida.
 */
export interface GlossaryTerm {
  term: string;
  plain: string;
  gloss: string;
}

const COMMON: GlossaryTerm[] = [
  { term: 'Dosis', plain: 'Cantidad de medicamento que se toma cada vez.', gloss: 'DOSIS / CANTIDAD MEDICINA' },
  { term: 'Cada 8 horas', plain: 'Tres veces al día, separadas por 8 horas.', gloss: 'CADA 8 HORA' },
  { term: 'Efecto secundario', plain: 'Molestia que puede causar un medicamento.', gloss: 'MEDICINA CAUSAR MOLESTIA' },
  { term: 'Control', plain: 'Nueva cita para revisar cómo sigue el paciente.', gloss: 'CONTROL / CITA OTRA-VEZ' },
];

export const GLOSSARY: Record<string, GlossaryTerm[]> = {
  'Medicina Familiar': [
    { term: 'Faringitis', plain: 'Inflamación de la garganta.', gloss: 'GARGANTA INFLAMADA' },
    { term: 'Fiebre', plain: 'Temperatura del cuerpo de 38 °C o más.', gloss: 'FIEBRE / CUERPO CALIENTE' },
    { term: 'Hipertensión', plain: 'Presión de la sangre alta.', gloss: 'PRESIÓN-SANGRE ALTA' },
    { term: 'Analgésico', plain: 'Medicamento para el dolor.', gloss: 'MEDICINA DOLOR QUITAR' },
    { term: 'Antibiótico', plain: 'Medicamento contra infecciones por bacterias.', gloss: 'MEDICINA INFECCIÓN' },
    ...COMMON,
  ],
  'Neurología y Rehabilitación': [
    { term: 'Vértigo', plain: 'Sensación de que todo da vueltas.', gloss: 'MAREO VUELTAS' },
    { term: 'Accidente cerebrovascular', plain: 'Daño en el cerebro por falta de sangre.', gloss: 'CEREBRO SANGRE PROBLEMA' },
    { term: 'Fisioterapia', plain: 'Ejercicios guiados para recuperar movimiento.', gloss: 'EJERCICIO RECUPERAR MOVER' },
    { term: 'Resonancia magnética', plain: 'Examen que toma imágenes del cuerpo por dentro.', gloss: 'EXAMEN FOTO DENTRO CUERPO' },
    ...COMMON,
  ],
};

export function glossaryFor(specialty: string): GlossaryTerm[] {
  return GLOSSARY[specialty] ?? COMMON;
}
