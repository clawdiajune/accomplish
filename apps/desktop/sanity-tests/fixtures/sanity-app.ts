// apps/desktop/sanity-tests/fixtures/sanity-app.ts
import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { SanityModel } from '../utils/models';
import { getApiKeyForModel } from '../utils/models';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Timeout constants for sanity tests
export const SANITY_TIMEOUTS = {
  APP_LAUNCH: 30000,
  HYDRATION: 15000,
  TASK_COMPLETE: 300000, // 5 minutes for agent work
  APP_RESTART: 2000,
} as const;

/**
 * Fixtures for sanity testing with real API calls.
 */
type SanityFixtures = {
  /** The Electron application instance */
  electronApp: ElectronApplication;
  /** The main renderer window */
  window: Page;
  /** Current model being tested (set per-test) */
  currentModel: SanityModel;
};

/**
 * Extended Playwright test with sanity fixtures.
 * NO MOCKS - uses real API calls.
 */
export const test = base.extend<SanityFixtures>({
  currentModel: [async ({}, use) => {
    // This will be overridden in test files
    throw new Error('currentModel must be set in test');
  }, { option: true }],

  electronApp: async ({ currentModel }, use) => {
    const mainPath = resolve(__dirname, '../../dist-electron/main/index.js');
    const apiKey = getApiKeyForModel(currentModel);

    // Build env object, filtering out undefined values
    const envVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        envVars[key] = value;
      }
    }

    // Launch WITHOUT mock flags - real API calls
    const app = await electron.launch({
      args: [
        mainPath,
        '--e2e-skip-auth', // Skip onboarding UI but still use real keys
      ],
      env: {
        ...envVars,
        E2E_SKIP_AUTH: '1',
        // NO E2E_MOCK_TASK_EVENTS - we want real execution
        NODE_ENV: 'test',
        // Also pass via env var as fallback
        [`${currentModel.envKeyName}`]: apiKey,
        // Store provider and API key for injection
        SANITY_TEST_PROVIDER: currentModel.provider,
        SANITY_TEST_API_KEY: apiKey,
      },
    });

    await use(app);

    await app.close();
    await new Promise(resolve => setTimeout(resolve, SANITY_TIMEOUTS.APP_RESTART));
  },

  window: async ({ electronApp, currentModel }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('load');

    // Wait for React hydration
    await window.waitForSelector('[data-testid="task-input-textarea"]', {
      state: 'visible',
      timeout: SANITY_TIMEOUTS.HYDRATION,
    });

    // Configure the provider system for real API calls
    // The new provider system requires:
    // 1. Store the API key via addApiKey (for secure storage)
    // 2. Register the provider via setConnectedProvider
    // 3. Set it as active via setActiveProvider
    const apiKey = getApiKeyForModel(currentModel);
    await window.evaluate(async ({ provider, modelId, apiKey: key }) => {
      // window.accomplish is exposed by the preload script
      type AccomplishAPI = {
        addApiKey: (p: string, k: string) => Promise<unknown>;
        setConnectedProvider: (p: string, provider: unknown) => Promise<void>;
        setActiveProvider: (p: string) => Promise<void>;
      };
      const accomplish = (window as unknown as { accomplish: AccomplishAPI }).accomplish;

      // Step 1: Store the API key in secure storage
      if (accomplish?.addApiKey) {
        await accomplish.addApiKey(provider, key);
        console.log(`[Sanity Test] Stored API key for provider: ${provider}`);
      } else {
        console.error('[Sanity Test] accomplish.addApiKey not available');
        return;
      }

      // Step 2: Register the provider with credentials and selected model
      const connectedProvider = {
        providerId: provider,
        connectionStatus: 'connected',
        selectedModelId: modelId,
        credentials: {
          type: 'api_key',
          keyPrefix: key.substring(0, 8) + '...',
        },
        lastConnectedAt: new Date().toISOString(),
      };

      if (accomplish?.setConnectedProvider) {
        await accomplish.setConnectedProvider(provider, connectedProvider);
        console.log(`[Sanity Test] Registered provider: ${provider} with model: ${modelId}`);
      } else {
        console.error('[Sanity Test] accomplish.setConnectedProvider not available');
        return;
      }

      // Step 3: Set this provider as the active one
      if (accomplish?.setActiveProvider) {
        await accomplish.setActiveProvider(provider);
        console.log(`[Sanity Test] Set active provider: ${provider}`);
      } else {
        console.error('[Sanity Test] accomplish.setActiveProvider not available');
      }
    }, { provider: currentModel.provider, modelId: currentModel.modelId, apiKey });

    await use(window);
  },
});

export { expect } from '@playwright/test';
