/**
 * Utility functions for model and provider display names
 */

import type { ProviderType } from '@accomplish/shared';
import { MODEL_DISPLAY_NAMES, PROVIDER_PREFIXES } from '@accomplish/shared';

/**
 * Provider display names
 */
const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google AI',
  xai: 'xAI',
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot AI',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
  litellm: 'LiteLLM',
  bedrock: 'Amazon Bedrock',
  zai: 'Z.AI',
  minimax: 'MiniMax',
  lmstudio: 'LM Studio',
  'azure-foundry': 'Azure Foundry',
  custom: 'Custom',
};

/**
 * Convert a model ID to a human-readable display name
 */
export function getModelDisplayName(modelId: string): string {
  if (!modelId) {
    return 'AI';
  }

  // Strip provider prefixes
  let cleanId = modelId;
  for (const prefix of PROVIDER_PREFIXES) {
    if (cleanId.startsWith(prefix)) {
      cleanId = cleanId.slice(prefix.length);
      break;
    }
  }

  // Handle openrouter format: openrouter/provider/model
  if (cleanId.includes('/')) {
    cleanId = cleanId.split('/').pop() || cleanId;
  }

  // Strip date suffixes (e.g., "-20250514", "-20241022")
  cleanId = cleanId.replace(/-\d{8}$/, '');

  // Check for known model mapping
  if (MODEL_DISPLAY_NAMES[cleanId]) {
    return MODEL_DISPLAY_NAMES[cleanId];
  }

  // Fallback: capitalize and clean up the model ID
  return cleanId
    .split('-')
    .map(part => {
      // Keep version numbers as-is
      if (/^\d/.test(part)) return part;
      // Capitalize first letter
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || 'AI';
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(providerId: ProviderType | string | null): string {
  if (!providerId) {
    return 'Provider';
  }
  return PROVIDER_DISPLAY_NAMES[providerId as ProviderType] || providerId;
}
