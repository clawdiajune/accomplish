/**
 * Test Local Agent Config Generator
 *
 * Generates an isolated OpenCode config for testing the local agent that doesn't
 * conflict with the main `pnpm dev` instance.
 *
 * Writes config to ~/.opencode/opencode-test-local-agent.json
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OpenCodeConfig {
  $schema?: string;
  model?: string;
  default_agent?: string;
  enabled_providers?: string[];
  permission?: string;
  agent?: Record<string, { description?: string; prompt?: string; mode?: string }>;
  provider?: Record<string, unknown>;
}

/**
 * Generate isolated OpenCode config for test local agent
 */
export function generateTestLocalAgentConfig(): string {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.opencode');
  const configPath = path.join(configDir, 'opencode-test-local-agent.json');

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const config: OpenCodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    default_agent: 'accomplish',
    enabled_providers: ['anthropic', 'openai', 'google', 'xai'],
    permission: 'allow',
    agent: {
      accomplish: {
        description: 'Automation assistant for test local agent',
        mode: 'primary',
      },
    },
  };

  const configJson = JSON.stringify(config, null, 2);
  fs.writeFileSync(configPath, configJson);

  console.log('[test-local-agent] Config generated at:', configPath);

  return configPath;
}

// Allow running directly (ES module check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  generateTestLocalAgentConfig();
}
