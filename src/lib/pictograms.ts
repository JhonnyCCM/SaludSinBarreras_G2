import type { DisabilityCategory, PictogramType } from './ai-harness/types';

export function getDisabilityIconSvg(category: DisabilityCategory): string {
  switch (category) {
    case 'auditiva':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/></svg>`;
    case 'visual':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    case 'motriz':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="4.5" r="2"/><path d="M12 8v5l4 2v5"/><path d="M8.5 13.5a4.5 4.5 0 1 0 6 4.2"/></svg>`;
    case 'cognitiva':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9.5 4a3.5 3.5 0 0 0-3.5 3.5c0 .7.2 1.3.5 1.9A3.5 3.5 0 0 0 5 12.5 3.5 3.5 0 0 0 7.5 16v1a3 3 0 0 0 3 3h1.5V4h-2.5Z"/><path d="M14.5 4a3.5 3.5 0 0 1 3.5 3.5c0 .7-.2 1.3-.5 1.9A3.5 3.5 0 0 1 19 12.5a3.5 3.5 0 0 1-2.5 3.5v1a3 3 0 0 1-3 3H12V4h2.5Z"/></svg>`;
    case 'habla':
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>`;
  }
}

export function getMedicationPictogramSvg(type: PictogramType): string {
  switch (type) {
    case 'pastilla':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;
    case 'jarabe':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 3h6"/><path d="M10 3v3l-3 3v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9l-3-3V3"/><path d="M9 14h6"/><path d="M12 11v6"/></svg>`;
    case 'gotas':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
    case 'inhalador':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 4h6v10l5 3v3H7z"/><path d="M7 8h6"/></svg>`;
    case 'inyeccion':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/></svg>`;
    case 'alerta':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    case 'cuidado':
    default:
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-4.35-9-8.5C1.5 9.4 3.5 6 7 6c2 0 3.5 1 5 2.7C13.5 7 15 6 17 6c3.5 0 5.5 3.4 4 6.5-2 4.15-9 8.5-9 8.5Z"/></svg>`;
  }
}
