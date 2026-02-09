# Google Vertex AI Provider Integration — Design

## Overview

Add Google Vertex AI as a new provider (`'vertex'`) in Accomplish, separate from the existing `'google'` (Gemini API) provider. Follows the Bedrock provider pattern: multi-tab auth, dynamic model fetching, custom credential storage.

## Provider Identity

- **Provider ID:** `'vertex'`
- **Display name:** Google Vertex AI
- **Category:** `'gcp'` (new category, like `'aws'` for Bedrock)
- **Logo:** New `vertex.svg` icon in `ai-logos/`
- **`requiresApiKey`:** `false` (uses credentials, not a simple key)
- **`models`:** `[]` (populated at connect time)

## Authentication — Two Methods

### Tab 1: Service Account JSON (default)

Three input methods for the JSON key:
1. **Drag-and-drop** — dashed-border drop zone
2. **Browse button** — file picker fallback inside the drop zone
3. **Paste JSON** — toggle to a text area for raw paste

On valid JSON input:
- Auto-extract `project_id` from the key file, pre-fill the Project ID field (editable)
- Show service account email as confirmation
- On invalid JSON: inline error

Additional fields:
- **Project ID** — text input, pre-filled from JSON, user can override
- **Location** — searchable dropdown with Vertex AI regions

### Tab 2: Application Default Credentials (ADC)

- Info text: "Uses credentials from `gcloud auth application-default login`"
- **Project ID** — auto-detected via `gcloud config get-value project`, editable
- **Location** — same searchable dropdown
- Hint if gcloud not found: "Install Google Cloud SDK to use ADC"

### Both methods require

- `projectId` (string)
- `location` (string, e.g. `us-central1`)

## Credential Types

```typescript
interface VertexServiceAccountCredentials {
  authType: 'serviceAccount';
  serviceAccountJson: string;  // full JSON key content
  projectId: string;
  location: string;
}

interface VertexAdcCredentials {
  authType: 'adc';
  projectId: string;
  location: string;
}

type VertexCredentials = VertexServiceAccountCredentials | VertexAdcCredentials;

// For UI display (stored in ConnectedProvider.credentials)
interface VertexProviderCredentials {
  type: 'vertex';
  authMethod: 'serviceAccount' | 'adc';
  projectId: string;
  location: string;
  serviceAccountEmail?: string;  // masked for display
}
```

## Model Fetching — Curated List + Verify

**Strategy:** Maintain a hardcoded curated list of known inference-ready models. At connect time, verify availability per project/region.

### Curated model list (in `packages/shared/`)

Grouped by publisher:
- **Google:** gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, etc.
- **Anthropic:** claude-sonnet-4-5, claude-opus-4, claude-haiku-3-5, etc.
- **Mistral:** mistral-large, mistral-nemo, codestral, etc.

### Verification at connect time

For each model in the curated list:
- Call `GET https://{location}-aiplatform.googleapis.com/v1/publishers/{publisher}/models/{model}`
- Only show models that return successfully (available in user's region)
- Parallel requests for speed

### Custom model ID

In addition to the verified curated list, the model selector includes a **"Custom model ID"** text input where users can type any `publisher/model` string (e.g. `google/my-fine-tuned-gemini`). No verification on custom IDs — passed through directly.

### Authentication for API calls

- **Service Account:** construct JWT from JSON key -> exchange for access token at `oauth2.googleapis.com/token` -> use as Bearer token
- **ADC:** shell out to `gcloud auth print-access-token`

## UI Components

### VertexProviderForm

Mirrors BedrockProviderForm pattern:
- Two auth tabs at top (Service Account / ADC)
- Tab-specific form fields below
- Connect button validates -> saves -> fetches models
- Connected state: shows auth method, project, location, model selector, disconnect button

### Drop zone component

Dashed-border area in Service Account tab:
- Accepts `.json` file drag-and-drop
- "Browse" button inside as fallback
- "Paste JSON" toggle to switch to text area mode
- Visual feedback: highlight on drag-over, error state on invalid file

### LocationSelector (shared, reusable)

Searchable dropdown with ~30 Vertex AI locations:
- US: us-central1, us-east1, us-east4, us-east5, us-south1, us-west1, us-west4
- Canada: northamerica-northeast1
- South America: southamerica-east1
- Europe: europe-west1, europe-west2, europe-west3, europe-west4, europe-west6, europe-west8, europe-west9, europe-southwest1, europe-north1, europe-central2
- Asia: asia-northeast1, asia-northeast3, asia-east1, asia-east2, asia-southeast1, asia-south1, australia-southeast1
- Middle East: me-central1, me-central2, me-west1

### Model selector

Same `ModelSelector` component used by Bedrock, with addition of:
- "Use custom model ID" option at the bottom
- Text input that appears when custom option selected

## Backend

### New file: `packages/core/src/providers/vertex.ts`

**`validateVertexCredentials(credentialsJson: string): Promise<ValidationResult>`**
- Service Account: parse JSON, verify required fields (type, project_id, private_key, client_email), make test `models.get` call
- ADC: attempt same call using gcloud access token
- Returns `{ valid: boolean; error?: string }`

**`fetchVertexModels(credentials: VertexCredentials): Promise<FetchVertexModelsResult>`**
- Iterate curated model list
- Call `GET v1/publishers/{publisher}/models/{model}` for each (parallel)
- Return available models as `{ id: "vertex/{publisher}/{model}", name, provider }`

### IPC Handlers (4 new, mirroring Bedrock)

| Channel | Purpose |
|---------|---------|
| `vertex:validate` | Validate credentials |
| `vertex:fetch-models` | List available models |
| `vertex:save` | Store credentials (encrypted) |
| `vertex:get-credentials` | Retrieve stored credentials |

### Preload API

Four new methods on `window.accomplish`:
- `validateVertexCredentials(credentials: string)`
- `saveVertexCredentials(credentials: string)`
- `getVertexCredentials()`
- `fetchVertexModels(credentialsJson: string)`

### Config Generation (`config-builder.ts`)

- Maps `vertex` -> OpenCode provider ID
- Passes `projectId`, `location`, credential type as provider options
- Service Account: sets `GOOGLE_APPLICATION_CREDENTIALS` env var pointing to temp file with JSON key
- ADC: no credential config, just project + location

## E2E Tests

### `settings-vertex-google.spec.ts`

- Provider card appears in grid
- Two auth tabs render
- Service Account tab: drop zone renders, paste JSON flow works, project ID auto-fills, location selector works
- ADC tab: project ID field and location selector render
- Connect with credentials -> models fetched
- Select Gemini model -> becomes active
- Run short task -> e2e inference works
- Disconnect -> state clears

### `settings-vertex-anthropic.spec.ts`

- Same connection flow
- Select Claude model from fetched list
- Run short task -> e2e inference works via Vertex
- Verifies Anthropic model routing through Vertex

### Shared

- Page object: `VertexSettingsPage` in `e2e/pages/`
- Mock service account JSON fixture (no real keys in repo)
- Real E2E needs CI secret for test GCP project

## File Changes

### New files (8)

| File | Purpose |
|------|---------|
| `packages/core/src/providers/vertex.ts` | Validation + model fetching |
| `apps/desktop/src/renderer/components/settings/providers/VertexProviderForm.tsx` | Main form with auth tabs |
| `apps/desktop/src/renderer/components/settings/providers/VertexServiceAccountTab.tsx` | JSON drop zone + fields |
| `apps/desktop/src/renderer/components/settings/providers/VertexAdcTab.tsx` | ADC fields |
| `apps/desktop/src/renderer/components/settings/shared/LocationSelector.tsx` | Vertex AI locations dropdown |
| `apps/desktop/public/assets/ai-logos/vertex.svg` | Vertex AI icon |
| `apps/desktop/e2e/specs/settings-vertex-google.spec.ts` | E2E: Google models |
| `apps/desktop/e2e/specs/settings-vertex-anthropic.spec.ts` | E2E: Anthropic models |

### Modified files (~8)

| File | Change |
|------|--------|
| `packages/shared/src/types/provider.ts` | Add `'vertex'` to ProviderType, DEFAULT_PROVIDERS |
| `packages/shared/src/types/auth.ts` | Add VertexCredentials types |
| `packages/shared/src/types/providerSettings.ts` | Add `'vertex'` to PROVIDER_META with category `'gcp'` |
| `apps/desktop/src/main/ipc/handlers.ts` | Four new `vertex:*` IPC handlers |
| `apps/desktop/src/preload/index.ts` | Four new methods on window.accomplish |
| `packages/core/src/opencode/config-builder.ts` | Vertex provider config generation |
| `apps/desktop/src/renderer/components/settings/ProviderSettingsPanel.tsx` | Add `'gcp'` category -> VertexProviderForm |
| `apps/desktop/src/renderer/lib/provider-logos.ts` | Import vertex logo |
