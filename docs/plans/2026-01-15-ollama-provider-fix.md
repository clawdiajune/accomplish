# Ollama Provider Configuration Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix OpenCode integration so Ollama models are recognized by adding proper provider configuration

**Architecture:** OpenCode requires explicit provider definitions with npm package, baseURL, and model registry. We need to: (1) extend OllamaConfig to store discovered models, (2) update IPC handlers to persist models, (3) update config-generator to include the `provider` section with Ollama configuration.

**Tech Stack:** TypeScript, Electron IPC, electron-store, OpenCode CLI

---

### Task 1: Extend OllamaConfig Type to Include Models

**Files:**
- Modify: `packages/shared/src/types/provider.ts:35-39`

**Step 1: Update OllamaConfig interface**

Add a `models` array to store discovered Ollama models:

```typescript
/**
 * Ollama model info from API
 */
export interface OllamaModelInfo {
  id: string;        // e.g., "qwen3:latest"
  displayName: string;
  size: number;
}

/**
 * Ollama server configuration
 */
export interface OllamaConfig {
  baseUrl: string;
  enabled: boolean;
  lastValidated?: number;
  models?: OllamaModelInfo[];  // Discovered models from Ollama API
}
```

**Step 2: Run typecheck to verify**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/shared/src/types/provider.ts
git commit -m "feat(types): add models array to OllamaConfig for storing discovered models"
```

---

### Task 2: Update IPC Handler to Persist Discovered Models

**Files:**
- Modify: `apps/desktop/src/main/ipc/handlers.ts:926-950`

**Step 1: Update ollama:set-config handler to accept models**

The handler already accepts OllamaConfig, and TypeScript will now expect models. Update validation:

```typescript
handle('ollama:set-config', async (_event: IpcMainInvokeEvent, config: OllamaConfig | null) => {
  if (config !== null) {
    if (typeof config.baseUrl !== 'string' || typeof config.enabled !== 'boolean') {
      throw new Error('Invalid Ollama configuration');
    }
    // Validate URL format and protocol
    try {
      const parsed = new URL(config.baseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http and https URLs are allowed');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('http')) {
        throw e;
      }
      throw new Error('Invalid base URL format');
    }
    // Validate optional lastValidated if present
    if (config.lastValidated !== undefined && typeof config.lastValidated !== 'number') {
      throw new Error('Invalid Ollama configuration');
    }
    // Validate optional models array if present
    if (config.models !== undefined) {
      if (!Array.isArray(config.models)) {
        throw new Error('Invalid Ollama configuration: models must be an array');
      }
      for (const model of config.models) {
        if (typeof model.id !== 'string' || typeof model.displayName !== 'string' || typeof model.size !== 'number') {
          throw new Error('Invalid Ollama configuration: invalid model format');
        }
      }
    }
  }
  setOllamaConfig(config);
  console.log('[Ollama] Config saved:', config);
});
```

**Step 2: Run typecheck to verify**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/main/ipc/handlers.ts
git commit -m "feat(ipc): add validation for models array in ollama:set-config handler"
```

---

### Task 3: Update UI to Save Models When Saving Config

**Files:**
- Modify: `apps/desktop/src/renderer/components/layout/SettingsDialog.tsx`

**Step 1: Find handleSaveOllama function and update to include models**

Locate the `handleSaveOllama` function and ensure it saves the discovered models:

```typescript
const handleSaveOllama = async () => {
  if (!ollamaConnected || !selectedOllamaModel) return;

  setSavingOllama(true);
  try {
    // Save config with discovered models
    await window.accomplish.setOllamaConfig({
      baseUrl: ollamaUrl,
      enabled: true,
      lastValidated: Date.now(),
      models: ollamaModels,  // Include discovered models
    });

    // Set selected model
    await window.accomplish.setSelectedModel({
      provider: 'ollama',
      model: `ollama/${selectedOllamaModel}`,
      baseUrl: ollamaUrl,
    });

    // Show success feedback
    setStatusMessage('Ollama model saved successfully!');
  } catch (err) {
    setOllamaError(err instanceof Error ? err.message : 'Failed to save');
  } finally {
    setSavingOllama(false);
  }
};
```

**Step 2: Run typecheck to verify**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/layout/SettingsDialog.tsx
git commit -m "feat(ui): save discovered models when saving Ollama config"
```

---

### Task 4: Update OpenCodeConfig Interface

**Files:**
- Modify: `apps/desktop/src/main/opencode/config-generator.ts:334-342`

**Step 1: Add provider interface to OpenCodeConfig**

Add the provider configuration types:

```typescript
interface OllamaProviderModelConfig {
  name: string;
  tools?: boolean;
}

interface OllamaProviderConfig {
  npm: string;
  name: string;
  options: {
    baseURL: string;
  };
  models: Record<string, OllamaProviderModelConfig>;
}

interface OpenCodeConfig {
  $schema?: string;
  model?: string;
  default_agent?: string;
  enabled_providers?: string[];
  permission?: string | Record<string, string | Record<string, string>>;
  agent?: Record<string, AgentConfig>;
  mcp?: Record<string, McpServerConfig>;
  provider?: Record<string, OllamaProviderConfig>;  // Add provider section
}
```

**Step 2: Run typecheck to verify**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/main/opencode/config-generator.ts
git commit -m "feat(config): add provider interface to OpenCodeConfig type"
```

---

### Task 5: Generate Ollama Provider Configuration

**Files:**
- Modify: `apps/desktop/src/main/opencode/config-generator.ts:367-402`

**Step 1: Add Ollama provider config generation**

Update the `generateOpenCodeConfig` function to include the provider section:

```typescript
// Enable providers - add ollama if configured
const ollamaConfig = getOllamaConfig();
const baseProviders = ['anthropic', 'openai', 'google', 'groq'];
const enabledProviders = ollamaConfig?.enabled
  ? [...baseProviders, 'ollama']
  : baseProviders;

// Build Ollama provider configuration if enabled
let providerConfig: Record<string, OllamaProviderConfig> | undefined;
if (ollamaConfig?.enabled && ollamaConfig.models && ollamaConfig.models.length > 0) {
  const ollamaModels: Record<string, OllamaProviderModelConfig> = {};
  for (const model of ollamaConfig.models) {
    ollamaModels[model.id] = {
      name: model.displayName,
      tools: true,  // Enable tool calling for all models
    };
  }

  providerConfig = {
    ollama: {
      npm: '@ai-sdk/openai-compatible',
      name: 'Ollama (local)',
      options: {
        baseURL: `${ollamaConfig.baseUrl}/v1`,  // OpenAI-compatible endpoint
      },
      models: ollamaModels,
    },
  };

  console.log('[OpenCode Config] Ollama provider configured with models:', Object.keys(ollamaModels));
}

const config: OpenCodeConfig = {
  $schema: 'https://opencode.ai/config.json',
  default_agent: ACCOMPLISH_AGENT_NAME,
  enabled_providers: enabledProviders,
  permission: 'allow',
  provider: providerConfig,  // Include provider config
  agent: {
    [ACCOMPLISH_AGENT_NAME]: {
      description: 'Browser automation assistant using dev-browser',
      prompt: systemPrompt,
      mode: 'primary',
    },
  },
  mcp: {
    'file-permission': {
      type: 'local',
      command: ['npx', 'tsx', filePermissionServerPath],
      enabled: true,
      environment: {
        PERMISSION_API_PORT: String(PERMISSION_API_PORT),
      },
      timeout: 10000,
    },
  },
};
```

**Step 2: Run typecheck to verify**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/main/opencode/config-generator.ts
git commit -m "feat(config): generate Ollama provider config with discovered models"
```

---

### Task 6: Integration Test

**Files:**
- None (manual testing)

**Step 1: Start the app**

Run: `pnpm dev`

**Step 2: Test Ollama connection**

1. Open Settings
2. Go to Local Models tab
3. Click "Test Connection" with `http://localhost:11434`
4. Verify models are discovered
5. Select a model (e.g., qwen3:latest)
6. Click "Use This Model"

**Step 3: Verify config generation**

Check the generated config includes the provider section:

Run: `cat ~/Library/Application\ Support/@accomplish/desktop/opencode/opencode.json | jq '.provider'`

Expected output should show:
```json
{
  "ollama": {
    "npm": "@ai-sdk/openai-compatible",
    "name": "Ollama (local)",
    "options": {
      "baseURL": "http://localhost:11434/v1"
    },
    "models": {
      "qwen3:latest": {
        "name": "qwen3:latest",
        "tools": true
      }
    }
  }
}
```

**Step 4: Test a task**

Run a simple task like "go to hacker news" and verify it executes without "ProviderModelNotFoundError".

**Step 5: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "test: verify Ollama provider integration"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add models to OllamaConfig type | `packages/shared/src/types/provider.ts` |
| 2 | Update IPC handler validation | `apps/desktop/src/main/ipc/handlers.ts` |
| 3 | Save models from UI | `apps/desktop/src/renderer/components/layout/SettingsDialog.tsx` |
| 4 | Add provider interface | `apps/desktop/src/main/opencode/config-generator.ts` |
| 5 | Generate provider config | `apps/desktop/src/main/opencode/config-generator.ts` |
| 6 | Integration test | Manual testing |
