import { MODEL_DISPLAY_NAMES, PROVIDER_PREFIXES } from '@accomplish/shared';

export function getModelDisplayName(modelId: string): string {
  if (!modelId) {
    return 'AI';
  }

  let cleanId = modelId;
  for (const prefix of PROVIDER_PREFIXES) {
    if (cleanId.startsWith(prefix)) {
      cleanId = cleanId.slice(prefix.length);
      break;
    }
  }

  if (cleanId.includes('/')) {
    cleanId = cleanId.split('/').pop() || cleanId;
  }

  cleanId = cleanId.replace(/-\d{8}$/, '');

  if (MODEL_DISPLAY_NAMES[cleanId]) {
    return MODEL_DISPLAY_NAMES[cleanId];
  }

  return cleanId
    .split('-')
    .map(part => {
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || 'AI';
}

export function getKnownModelIds(): string[] {
  return Object.keys(MODEL_DISPLAY_NAMES);
}

export function isKnownModel(modelId: string): boolean {
  let cleanId = modelId;
  for (const prefix of PROVIDER_PREFIXES) {
    if (cleanId.startsWith(prefix)) {
      cleanId = cleanId.slice(prefix.length);
      break;
    }
  }
  if (cleanId.includes('/')) {
    cleanId = cleanId.split('/').pop() || cleanId;
  }
  cleanId = cleanId.replace(/-\d{8}$/, '');

  return cleanId in MODEL_DISPLAY_NAMES;
}
