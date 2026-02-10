import crypto from 'crypto';
import fs from 'fs';

const SA_KEY_PATH = '/Users/gale/Downloads/project-6a0f8f01-2856-41ed-9f6-a7a1c67a16f6.json';
const key = JSON.parse(fs.readFileSync(SA_KEY_PATH, 'utf-8'));

const PROJECT_ID = key.project_id;

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: key.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const response = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!response.ok) throw new Error(`Token exchange failed: ${await response.text()}`);
  const data = await response.json();
  console.log('Access token obtained.\n');
  return data.access_token;
}

async function testUrl(token, label, url, method = 'GET', body = undefined) {
  try {
    const opts = { method, headers: { Authorization: `Bearer ${token}` } };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const isJson = (res.headers.get('content-type') || '').includes('json');
    const text = await res.text();
    const preview = text.substring(0, 250);
    console.log(`[${res.status}] ${label}`);
    console.log(`  URL: ${url}`);
    if (isJson) {
      try { console.log(`  Body: ${JSON.stringify(JSON.parse(text), null, 2).substring(0, 300)}`); } catch { console.log(`  Body: ${preview}`); }
    } else {
      console.log(`  Body (non-JSON): ${preview.replace(/\n/g, ' ').substring(0, 150)}`);
    }
    console.log();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    console.log(`[ERR] ${label}: ${err.message}\n`);
    return { ok: false };
  }
}

async function main() {
  const token = await getAccessToken();

  console.log('========== 1. VALIDATION: Find the right endpoint to test connectivity ==========\n');

  // Try listing models via various endpoints
  await testUrl(token, 'List models (regional, v1)',
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/models`);

  await testUrl(token, 'List publishers (regional, v1)',
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers`);

  // The generativelanguage-style endpoint used by Vertex
  await testUrl(token, 'List models (v1beta1, Generative AI)',
    `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models`);

  await testUrl(token, 'List models (v1, Generative AI)',
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models`);

  // Get a specific model
  await testUrl(token, 'Get model gemini-2.0-flash (v1)',
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.0-flash`);

  // Simple generateContent as validation (the one that worked)
  await testUrl(token, 'generateContent (us-central1)',
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`,
    'POST',
    { contents: [{ role: 'user', parts: [{ text: 'Say hi' }] }] });

  // Test global endpoint with generateContent
  await testUrl(token, 'generateContent (global)',
    `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/gemini-2.0-flash:generateContent`,
    'POST',
    { contents: [{ role: 'user', parts: [{ text: 'Say hi' }] }] });

  console.log('========== 2. MODEL DISCOVERY: Check which models respond ==========\n');

  const models = [
    { publisher: 'google', id: 'gemini-2.5-pro' },
    { publisher: 'google', id: 'gemini-2.5-flash' },
    { publisher: 'google', id: 'gemini-2.0-flash' },
    { publisher: 'google', id: 'gemini-1.5-pro' },
    { publisher: 'anthropic', id: 'claude-sonnet-4-5' },
    { publisher: 'anthropic', id: 'claude-opus-4' },
    { publisher: 'mistral', id: 'mistral-large' },
  ];

  for (const m of models) {
    // Use generateContent with a tiny prompt as the availability check
    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/${m.publisher}/models/${m.id}:generateContent`;
    const res = await testUrl(token, `${m.publisher}/${m.id}`, url, 'POST',
      { contents: [{ role: 'user', parts: [{ text: 'Say hi' }] }] });
  }
}

main().catch(console.error);
