import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getOllamaConfig } from '../store/appSettings';
import { getApiKey } from '../store/secureStorage';
import { getProviderSettings, getActiveProviderModel, getConnectedProviderIds } from '../store/providerSettings';
import { ensureAzureFoundryProxy } from './azure-foundry-proxy';
import type { BedrockCredentials, ProviderId, AzureFoundryCredentials } from '@accomplish/shared';

/**
 * Agent name used by Accomplish
 */
export const ACCOMPLISH_AGENT_NAME = 'accomplish';

interface AgentConfig {
  description?: string;
  prompt?: string;
  mode?: 'primary' | 'subagent' | 'all';
}

interface ProviderModelConfig {
  name: string;
  tools?: boolean;
  limit?: {
    context?: number;
    output?: number;
  };
  options?: Record<string, unknown>;
}

interface OllamaProviderConfig {
  npm: string;
  name: string;
  options: {
    baseURL: string;
  };
  models: Record<string, ProviderModelConfig>;
}

interface BedrockProviderConfig {
  options: {
    region: string;
    profile?: string;
  };
}

interface AzureFoundryProviderConfig {
  npm: string;
  name: string;
  options: {
    resourceName?: string;
    baseURL?: string;
    apiKey?: string;
    headers?: Record<string, string>;
  };
  models: Record<string, ProviderModelConfig>;
}

interface OpenRouterProviderModelConfig {
  name: string;
  tools?: boolean;
}

interface OpenRouterProviderConfig {
  npm: string;
  name: string;
  options: {
    baseURL: string;
  };
  models: Record<string, OpenRouterProviderModelConfig>;
}

interface LiteLLMProviderModelConfig {
  name: string;
  tools?: boolean;
}

interface LiteLLMProviderConfig {
  npm: string;
  name: string;
  options: {
    baseURL: string;
    apiKey?: string;
  };
  models: Record<string, LiteLLMProviderModelConfig>;
}

interface ZaiProviderModelConfig {
  name: string;
  tools?: boolean;
}

interface ZaiProviderConfig {
  npm: string;
  name: string;
  options: {
    baseURL: string;
  };
  models: Record<string, ZaiProviderModelConfig>;
}

type ProviderConfig = OllamaProviderConfig | BedrockProviderConfig | AzureFoundryProviderConfig | OpenRouterProviderConfig | LiteLLMProviderConfig | ZaiProviderConfig;

interface OpenCodeConfig {
  $schema?: string;
  model?: string;
  default_agent?: string;
  enabled_providers?: string[];
  permission?: string | Record<string, string | Record<string, string>>;
  agent?: Record<string, AgentConfig>;
  provider?: Record<string, ProviderConfig>;
}

/**
 * Build Azure Foundry provider configuration for OpenCode CLI
 * Shared helper to avoid duplication between new settings and legacy paths
 */
async function buildAzureFoundryProviderConfig(
  endpoint: string,
  deploymentName: string,
  authMethod: 'api-key' | 'entra-id',
  azureFoundryToken?: string
): Promise<AzureFoundryProviderConfig | null> {
  const baseUrl = endpoint.replace(/\/$/, '');
  const targetBaseUrl = `${baseUrl}/openai/v1`;
  const proxyInfo = await ensureAzureFoundryProxy(targetBaseUrl);

  // Build options for @ai-sdk/openai-compatible provider
  // Route through local proxy to strip unsupported params for Azure Foundry
  const azureOptions: AzureFoundryProviderConfig['options'] = {
    baseURL: proxyInfo.baseURL,
  };

  // Set API key or Entra ID token
  if (authMethod === 'api-key') {
    const azureApiKey = getApiKey('azure-foundry');
    if (azureApiKey) {
      azureOptions.apiKey = azureApiKey;
    }
  } else if (authMethod === 'entra-id' && azureFoundryToken) {
    azureOptions.apiKey = '';
    azureOptions.headers = {
      'Authorization': `Bearer ${azureFoundryToken}`,
    };
  }

  return {
    npm: '@ai-sdk/openai-compatible',
    name: 'Azure AI Foundry',
    options: azureOptions,
    models: {
      [deploymentName]: {
        name: `Azure Foundry (${deploymentName})`,
        tools: true,
        // Set conservative output token limit - can be overridden per-deployment
        // This prevents errors from models with lower limits (e.g., 16384 for some GPT-5 deployments)
        limit: {
          context: 128000,
          output: 16384,
        },
      },
    },
  };
}

/**
 * Generate OpenCode configuration file
 * OpenCode reads config from .opencode.json in the working directory or
 * from ~/.config/opencode/opencode.json
 * @param azureFoundryToken - Optional Entra ID token for Azure Foundry authentication
 */
export async function generateOpenCodeConfig(azureFoundryToken?: string): Promise<string> {
  const configDir = path.join(app.getPath('userData'), 'opencode');
  const configPath = path.join(configDir, 'opencode.json');

  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Get connected providers from new settings (with legacy fallback)
  const providerSettings = getProviderSettings();
  const connectedIds = getConnectedProviderIds();
  const activeModel = getActiveProviderModel();

  // Map our provider IDs to OpenCode CLI provider names
  const providerIdToOpenCode: Record<ProviderId, string> = {
    anthropic: 'anthropic',
    openai: 'openai',
    google: 'google',
    xai: 'xai',
    deepseek: 'deepseek',
    zai: 'zai-coding-plan',
    bedrock: 'amazon-bedrock',
    'azure-foundry': 'azure-foundry',
    ollama: 'ollama',
    openrouter: 'openrouter',
    litellm: 'litellm',
    minimax: 'minimax',
  };

  // Build enabled providers list from new settings or fall back to base providers
  const baseProviders = ['anthropic', 'openai', 'openrouter', 'google', 'xai', 'deepseek', 'zai-coding-plan', 'amazon-bedrock', 'minimax'];
  let enabledProviders = baseProviders;

  // If we have connected providers in the new settings, use those
  if (connectedIds.length > 0) {
    const mappedProviders = connectedIds.map(id => providerIdToOpenCode[id]);
    // Always include base providers to allow switching
    enabledProviders = [...new Set([...baseProviders, ...mappedProviders])];
    console.log('[OpenCode Config] Using connected providers from new settings:', mappedProviders);
  } else {
    // Legacy fallback: add ollama if configured in old settings
    const ollamaConfig = getOllamaConfig();
    if (ollamaConfig?.enabled) {
      enabledProviders = [...baseProviders, 'ollama'];
    }
  }

  // Build provider configurations
  const providerConfig: Record<string, ProviderConfig> = {};

  // Configure Ollama if connected (check new settings first, then legacy)
  const ollamaProvider = providerSettings.connectedProviders.ollama;
  if (ollamaProvider?.connectionStatus === 'connected' && ollamaProvider.credentials.type === 'ollama') {
    // New provider settings: Ollama is connected
    if (ollamaProvider.selectedModelId) {
      // OpenCode CLI splits "ollama/model" into provider="ollama" and modelID="model"
      // So we need to register the model without the "ollama/" prefix
      const modelId = ollamaProvider.selectedModelId.replace(/^ollama\//, '');
      providerConfig.ollama = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Ollama (local)',
        options: {
          baseURL: `${ollamaProvider.credentials.serverUrl}/v1`,
        },
        models: {
          [modelId]: {
            name: modelId,
            tools: true,
          },
        },
      };
      console.log('[OpenCode Config] Ollama configured from new settings:', modelId);
    }
  } else {
    // Legacy fallback: use old Ollama config
    const ollamaConfig = getOllamaConfig();
    if (ollamaConfig?.enabled && ollamaConfig.models && ollamaConfig.models.length > 0) {
      const ollamaModels: Record<string, ProviderModelConfig> = {};
      for (const model of ollamaConfig.models) {
        ollamaModels[model.id] = {
          name: model.displayName,
          tools: true,
        };
      }

      providerConfig.ollama = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Ollama (local)',
        options: {
          baseURL: `${ollamaConfig.baseUrl}/v1`,
        },
        models: ollamaModels,
      };

      console.log('[OpenCode Config] Ollama configured from legacy settings:', Object.keys(ollamaModels));
    }
  }

  // Configure OpenRouter if connected (check new settings first, then legacy)
  const openrouterProvider = providerSettings.connectedProviders.openrouter;
  if (openrouterProvider?.connectionStatus === 'connected' && activeModel?.provider === 'openrouter') {
    // New provider settings: OpenRouter is connected and active
    const modelId = activeModel.model.replace('openrouter/', '');
    providerConfig.openrouter = {
      npm: '@ai-sdk/openai-compatible',
      name: 'OpenRouter',
      options: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      models: {
        [modelId]: {
          name: modelId,
          tools: true,
        },
      },
    };
    console.log('[OpenCode Config] OpenRouter configured from new settings:', modelId);
  } else {
    // Legacy fallback: use old OpenRouter config
    const openrouterKey = getApiKey('openrouter');
    if (openrouterKey) {
      const { getSelectedModel } = await import('../store/appSettings');
      const selectedModel = getSelectedModel();

      const openrouterModels: Record<string, OpenRouterProviderModelConfig> = {};

      if (selectedModel?.provider === 'openrouter' && selectedModel.model) {
        const modelId = selectedModel.model.replace('openrouter/', '');
        openrouterModels[modelId] = {
          name: modelId,
          tools: true,
        };
      }

      if (Object.keys(openrouterModels).length > 0) {
        providerConfig.openrouter = {
          npm: '@ai-sdk/openai-compatible',
          name: 'OpenRouter',
          options: {
            baseURL: 'https://openrouter.ai/api/v1',
          },
          models: openrouterModels,
        };
        console.log('[OpenCode Config] OpenRouter configured from legacy settings:', Object.keys(openrouterModels));
      }
    }
  }

  // Configure Bedrock if connected (check new settings first, then legacy)
  const bedrockProvider = providerSettings.connectedProviders.bedrock;
  if (bedrockProvider?.connectionStatus === 'connected' && bedrockProvider.credentials.type === 'bedrock') {
    // New provider settings: Bedrock is connected
    const creds = bedrockProvider.credentials;
    const bedrockOptions: BedrockProviderConfig['options'] = {
      region: creds.region || 'us-east-1',
    };
    if (creds.authMethod === 'profile' && creds.profileName) {
      bedrockOptions.profile = creds.profileName;
    }
    providerConfig['amazon-bedrock'] = {
      options: bedrockOptions,
    };
    console.log('[OpenCode Config] Bedrock configured from new settings:', bedrockOptions);
  } else {
    // Legacy fallback: use old Bedrock config
    const bedrockCredsJson = getApiKey('bedrock');
    if (bedrockCredsJson) {
      try {
        const creds = JSON.parse(bedrockCredsJson) as BedrockCredentials;

        const bedrockOptions: BedrockProviderConfig['options'] = {
          region: creds.region || 'us-east-1',
        };

        if (creds.authType === 'profile' && creds.profileName) {
          bedrockOptions.profile = creds.profileName;
        }

        providerConfig['amazon-bedrock'] = {
          options: bedrockOptions,
        };

        console.log('[OpenCode Config] Bedrock configured from legacy settings:', bedrockOptions);
      } catch (e) {
        console.warn('[OpenCode Config] Failed to parse Bedrock credentials:', e);
      }
    }
  }

  // Configure LiteLLM if connected
  const litellmProvider = providerSettings.connectedProviders.litellm;
  if (litellmProvider?.connectionStatus === 'connected' && litellmProvider.credentials.type === 'litellm') {
    if (litellmProvider.selectedModelId) {
      // Get API key if available
      const litellmApiKey = getApiKey('litellm');
      const litellmOptions: LiteLLMProviderConfig['options'] = {
        baseURL: `${litellmProvider.credentials.serverUrl}/v1`,
      };
      if (litellmApiKey) {
        litellmOptions.apiKey = litellmApiKey;
      }
      providerConfig.litellm = {
        npm: '@ai-sdk/openai-compatible',
        name: 'LiteLLM',
        options: litellmOptions,
        models: {
          [litellmProvider.selectedModelId]: {
            name: litellmProvider.selectedModelId,
            tools: true,
          },
        },
      };
      console.log('[OpenCode Config] LiteLLM configured:', litellmProvider.selectedModelId, litellmApiKey ? '(with API key)' : '(no API key)');
    }
  }

  // Configure Azure Foundry if connected (check new settings first, then legacy)
  const azureFoundryProvider = providerSettings.connectedProviders['azure-foundry'];
  if (azureFoundryProvider?.connectionStatus === 'connected' && azureFoundryProvider.credentials.type === 'azure-foundry') {
    const creds = azureFoundryProvider.credentials;
    const config = await buildAzureFoundryProviderConfig(
      creds.endpoint,
      creds.deploymentName,
      creds.authMethod,
      azureFoundryToken
    );

    if (config) {
      providerConfig['azure-foundry'] = config;

      if (!enabledProviders.includes('azure-foundry')) {
        enabledProviders.push('azure-foundry');
      }

      console.log('[OpenCode Config] Azure Foundry configured from new settings:', {
        deployment: creds.deploymentName,
        authMethod: creds.authMethod,
      });
    }
  } else {
    // TODO: Remove legacy Azure Foundry config support in v0.4.0
    // Legacy fallback: use old Azure Foundry config
    const { getAzureFoundryConfig } = await import('../store/appSettings');
    const azureFoundryConfig = getAzureFoundryConfig();
    if (azureFoundryConfig?.enabled && activeModel?.provider === 'azure-foundry') {
      const config = await buildAzureFoundryProviderConfig(
        azureFoundryConfig.baseUrl,
        azureFoundryConfig.deploymentName || 'default',
        azureFoundryConfig.authType,
        azureFoundryToken
      );

      if (config) {
        providerConfig['azure-foundry'] = config;

        if (!enabledProviders.includes('azure-foundry')) {
          enabledProviders.push('azure-foundry');
        }

        console.log('[OpenCode Config] Azure Foundry configured from legacy settings:', {
          deployment: azureFoundryConfig.deploymentName,
          authType: azureFoundryConfig.authType,
        });
      }
    }
  }

  // Add Z.AI Coding Plan provider configuration with all supported models
  // This is needed because OpenCode's built-in zai-coding-plan provider may not have all models
  const zaiKey = getApiKey('zai');
  if (zaiKey) {
    const zaiModels: Record<string, ZaiProviderModelConfig> = {
      'glm-4.7-flashx': { name: 'GLM-4.7 FlashX (Latest)', tools: true },
      'glm-4.7': { name: 'GLM-4.7', tools: true },
      'glm-4.7-flash': { name: 'GLM-4.7 Flash', tools: true },
      'glm-4.6': { name: 'GLM-4.6', tools: true },
      'glm-4.5-flash': { name: 'GLM-4.5 Flash', tools: true },
    };

    providerConfig['zai-coding-plan'] = {
      npm: '@ai-sdk/openai-compatible',
      name: 'Z.AI Coding Plan',
      options: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      },
      models: zaiModels,
    };
    console.log('[OpenCode Config] Z.AI Coding Plan provider configured with models:', Object.keys(zaiModels));
  }

  const config: OpenCodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    default_agent: ACCOMPLISH_AGENT_NAME,
    // Enable all supported providers - providers auto-configure when API keys are set via env vars
    enabled_providers: enabledProviders,
    // Auto-allow all tool permissions.
    // CLI-level permission prompts don't show in the UI and would block task execution.
    // Note: todowrite is disabled by default and must be explicitly enabled.
    permission: {
      '*': 'allow',
      todowrite: 'allow',
    },
    provider: Object.keys(providerConfig).length > 0 ? providerConfig : undefined,
    agent: {
      [ACCOMPLISH_AGENT_NAME]: {
        description: 'Automation assistant',
        mode: 'primary',
      },
    },
  };

  // Write config file
  const configJson = JSON.stringify(config, null, 2);
  fs.writeFileSync(configPath, configJson);

  // Set environment variables for OpenCode to find the config
  process.env.OPENCODE_CONFIG = configPath;
  process.env.OPENCODE_CONFIG_DIR = configDir;

  console.log('[OpenCode Config] Generated config at:', configPath);
  console.log('[OpenCode Config] Full config:', configJson);
  console.log('[OpenCode Config] OPENCODE_CONFIG env set to:', process.env.OPENCODE_CONFIG);
  console.log('[OpenCode Config] OPENCODE_CONFIG_DIR env set to:', process.env.OPENCODE_CONFIG_DIR);

  return configPath;
}

/**
 * Get the path where OpenCode config is stored
 */
export function getOpenCodeConfigPath(): string {
  return path.join(app.getPath('userData'), 'opencode', 'opencode.json');
}

/**
 * Get the path to OpenCode CLI's auth.json
 * OpenCode stores credentials in ~/.local/share/opencode/auth.json
 */
export function getOpenCodeAuthPath(): string {
  const homeDir = app.getPath('home');
  if (process.platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Local', 'opencode', 'auth.json');
  }
  return path.join(homeDir, '.local', 'share', 'opencode', 'auth.json');
}

/**
 * Sync API keys from Openwork's secure storage to OpenCode CLI's auth.json
 * This allows OpenCode CLI to recognize DeepSeek and Z.AI providers
 */
export async function syncApiKeysToOpenCodeAuth(): Promise<void> {
  const { getAllApiKeys } = await import('../store/secureStorage');
  const apiKeys = await getAllApiKeys();

  const authPath = getOpenCodeAuthPath();
  const authDir = path.dirname(authPath);

  // Ensure directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Read existing auth.json or create empty object
  let auth: Record<string, { type: string; key: string }> = {};
  if (fs.existsSync(authPath)) {
    try {
      auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    } catch (e) {
      console.warn('[OpenCode Auth] Failed to parse existing auth.json, creating new one');
      auth = {};
    }
  }

  let updated = false;

  // Sync DeepSeek API key
  if (apiKeys.deepseek) {
    if (!auth['deepseek'] || auth['deepseek'].key !== apiKeys.deepseek) {
      auth['deepseek'] = { type: 'api', key: apiKeys.deepseek };
      updated = true;
      console.log('[OpenCode Auth] Synced DeepSeek API key');
    }
  }

  // Sync Z.AI Coding Plan API key (maps to 'zai-coding-plan' provider in OpenCode CLI)
  if (apiKeys.zai) {
    if (!auth['zai-coding-plan'] || auth['zai-coding-plan'].key !== apiKeys.zai) {
      auth['zai-coding-plan'] = { type: 'api', key: apiKeys.zai };
      updated = true;
      console.log('[OpenCode Auth] Synced Z.AI Coding Plan API key');
    }
  }

  // Sync MiniMax API key
  if (apiKeys.minimax) {
    if (!auth.minimax || auth.minimax.key !== apiKeys.minimax) {
      auth.minimax = { type: 'api', key: apiKeys.minimax };
      updated = true;
      console.log('[OpenCode Auth] Synced MiniMax API key');
    }
  }

  // Write updated auth.json
  if (updated) {
    fs.writeFileSync(authPath, JSON.stringify(auth, null, 2));
    console.log('[OpenCode Auth] Updated auth.json at:', authPath);
  }
}
