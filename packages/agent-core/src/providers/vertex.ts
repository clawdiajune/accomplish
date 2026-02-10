import crypto from 'crypto';
import { execSync } from 'child_process';
import type { VertexCredentials } from '../common/types/auth.js';
import { safeParseJson } from '../utils/json.js';
import type { ValidationResult } from './validation.js';

const VERTEX_TOKEN_TIMEOUT_MS = 15000;

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
}

/**
 * Generates a signed JWT from a GCP service account key and exchanges it
 * for an access token via Google's OAuth2 token endpoint.
 */
async function getServiceAccountAccessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: key.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    signal: AbortSignal.timeout(VERTEX_TOKEN_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('No access token in response');
  }
  return data.access_token;
}

/**
 * Gets an access token using Application Default Credentials (gcloud CLI).
 * Uses `gcloud auth application-default print-access-token` which reads
 * credentials set up via `gcloud auth application-default login`.
 */
function getAdcAccessToken(): string {
  try {
    const token = execSync('gcloud auth application-default print-access-token', {
      timeout: VERTEX_TOKEN_TIMEOUT_MS,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!token) {
      throw new Error('Empty token returned from gcloud');
    }
    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('ENOENT') || message.includes('not found') || message.includes('not recognized')) {
      throw new Error('gcloud CLI not found. Install the Google Cloud SDK and run "gcloud auth application-default login".');
    }
    throw new Error(`Failed to get ADC token: ${message}`);
  }
}

/**
 * Obtains an access token based on the credential type.
 */
async function getVertexAccessToken(credentials: VertexCredentials): Promise<string> {
  if (credentials.authType === 'serviceAccount') {
    const parseResult = safeParseJson<ServiceAccountKey>(credentials.serviceAccountJson);
    if (!parseResult.success) {
      throw new Error('Invalid service account JSON');
    }
    return getServiceAccountAccessToken(parseResult.data);
  }
  return getAdcAccessToken();
}

/**
 * Returns the Vertex AI API base URL for a given location.
 * The "global" endpoint uses `aiplatform.googleapis.com` without a location prefix.
 */
function getVertexBaseUrl(location: string): string {
  if (location === 'global') {
    return 'https://aiplatform.googleapis.com';
  }
  return `https://${location}-aiplatform.googleapis.com`;
}

/**
 * Makes a test API call to Vertex AI to verify credentials and project access.
 * Uses a lightweight generateContent call since GET model metadata endpoints
 * return HTML 404s on many projects.
 */
async function testVertexAccess(accessToken: string, projectId: string, location: string): Promise<void> {
  const baseUrl = getVertexBaseUrl(location);
  const url = `${baseUrl}/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.0-flash:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Say hi' }] }],
    }),
    signal: AbortSignal.timeout(VERTEX_TOKEN_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      throw new Error('Authentication failed. Check your credentials and ensure the Vertex AI API is enabled.');
    }
    if (response.status === 404) {
      throw new Error(`Project "${projectId}" or location "${location}" not found. Verify your project ID and location.`);
    }
    throw new Error(`Vertex AI API error (${response.status}): ${errorText}`);
  }
}

/**
 * Validates Vertex AI credentials by obtaining an access token and making a test API call.
 */
export async function validateVertexCredentials(
  credentialsJson: string
): Promise<ValidationResult> {
  const parseResult = safeParseJson<VertexCredentials>(credentialsJson);
  if (!parseResult.success) {
    return { valid: false, error: 'Failed to parse credentials' };
  }

  const credentials = parseResult.data;

  if (!credentials.projectId?.trim()) {
    return { valid: false, error: 'Project ID is required' };
  }
  if (!credentials.location?.trim()) {
    return { valid: false, error: 'Location is required' };
  }

  if (credentials.authType === 'serviceAccount') {
    if (!credentials.serviceAccountJson?.trim()) {
      return { valid: false, error: 'Service account JSON key is required' };
    }
    const keyResult = safeParseJson<ServiceAccountKey>(credentials.serviceAccountJson);
    if (!keyResult.success) {
      return { valid: false, error: 'Invalid service account JSON format' };
    }
    const key = keyResult.data;
    if (!key.type || !key.project_id || !key.private_key || !key.client_email) {
      return { valid: false, error: 'Service account key missing required fields (type, project_id, private_key, client_email)' };
    }
  }

  try {
    const accessToken = await getVertexAccessToken(credentials);
    await testVertexAccess(accessToken, credentials.projectId, credentials.location);
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    return { valid: false, error: message };
  }
}

export interface VertexModel {
  id: string;
  name: string;
  provider: string;
}

export interface FetchVertexModelsResult {
  success: boolean;
  models: VertexModel[];
  error?: string;
}

/** Curated list of models available through Vertex AI, grouped by publisher. */
const VERTEX_CURATED_MODELS: Array<{ publisher: string; modelId: string; displayName: string }> = [
  // Google models
  { publisher: 'google', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
  { publisher: 'google', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
  { publisher: 'google', modelId: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
  { publisher: 'google', modelId: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
  // Anthropic models
  { publisher: 'anthropic', modelId: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5' },
  { publisher: 'anthropic', modelId: 'claude-opus-4', displayName: 'Claude Opus 4' },
  { publisher: 'anthropic', modelId: 'claude-haiku-3-5', displayName: 'Claude Haiku 3.5' },
  // Mistral models
  { publisher: 'mistral', modelId: 'mistral-large', displayName: 'Mistral Large' },
  { publisher: 'mistral', modelId: 'mistral-nemo', displayName: 'Mistral Nemo' },
  { publisher: 'mistral', modelId: 'codestral', displayName: 'Codestral' },
];

/**
 * Fetches available models from Vertex AI by checking a curated list of models
 * against the Vertex AI API.
 */
export async function fetchVertexModels(
  credentials: VertexCredentials
): Promise<FetchVertexModelsResult> {
  try {
    const accessToken = await getVertexAccessToken(credentials);
    const { projectId, location } = credentials;

    const baseUrl = getVertexBaseUrl(location);
    const results = await Promise.allSettled(
      VERTEX_CURATED_MODELS.map(async (model) => {
        const url = `${baseUrl}/v1/projects/${projectId}/locations/${location}/publishers/${model.publisher}/models/${model.modelId}:generateContent`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Say hi' }] }],
          }),
          signal: AbortSignal.timeout(VERTEX_TOKEN_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        return {
          id: `vertex/${model.publisher}/${model.modelId}`,
          name: model.displayName,
          provider: model.publisher,
        };
      })
    );

    const models: VertexModel[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        models.push(result.value);
      }
    }

    return { success: true, models };
  } catch (error) {
    console.error('[Vertex] Failed to fetch models:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage, models: [] };
  }
}
