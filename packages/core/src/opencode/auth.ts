import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

interface OpenCodeOauthAuthEntry {
  type?: string;
  refresh?: string;
  access?: string;
  expires?: number;
}

/**
 * Get the OpenCode data home directory.
 * OpenCode CLI uses XDG convention (.local/share) on ALL platforms including Windows.
 */
export function getOpenCodeDataHome(): string {
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

/**
 * Get the path to OpenCode's auth.json file.
 */
export function getOpenCodeAuthJsonPath(): string {
  return path.join(getOpenCodeDataHome(), 'opencode', 'auth.json');
}

function readOpenCodeAuthJson(): Record<string, unknown> | null {
  try {
    const authPath = getOpenCodeAuthJsonPath();
    if (!fs.existsSync(authPath)) return null;
    const raw = fs.readFileSync(authPath, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Get the OpenAI OAuth status from OpenCode's auth.json.
 * @returns Object with connected status and optional expiry timestamp
 */
export function getOpenAiOauthStatus(): { connected: boolean; expires?: number } {
  const authJson = readOpenCodeAuthJson();
  if (!authJson) return { connected: false };

  const entry = authJson.openai;
  if (!entry || typeof entry !== 'object') return { connected: false };

  const oauth = entry as OpenCodeOauthAuthEntry;
  if (oauth.type !== 'oauth') return { connected: false };

  // Treat a non-empty refresh token as the durable signal that the user completed OAuth.
  const refresh = oauth.refresh;
  const connected = typeof refresh === 'string' && refresh.trim().length > 0;
  return { connected, expires: oauth.expires };
}

/**
 * Get the path to OpenCode CLI's auth.json (used by config-generator)
 * OpenCode stores credentials in ~/.local/share/opencode/auth.json
 */
export function getOpenCodeAuthPath(): string {
  const homeDir = os.homedir();
  if (process.platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Local', 'opencode', 'auth.json');
  }
  return path.join(homeDir, '.local', 'share', 'opencode', 'auth.json');
}

/**
 * Write or update OpenCode CLI's auth.json with API keys.
 * @param providerKeys - Map of provider IDs to their auth entries
 */
export function writeOpenCodeAuth(providerKeys: Record<string, { type: string; key: string }>): void {
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

  // Merge provider keys
  for (const [providerId, entry] of Object.entries(providerKeys)) {
    auth[providerId] = entry;
  }

  // Write updated auth.json
  fs.writeFileSync(authPath, JSON.stringify(auth, null, 2));
  console.log('[OpenCode Auth] Updated auth.json at:', authPath);
}
