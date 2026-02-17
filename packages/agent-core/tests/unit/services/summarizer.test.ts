import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compactConversation } from '../../../src/services/summarizer.js';

describe('compactConversation', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Use vi.stubGlobal for consistent mock setup and teardown
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should return a summary string when given conversation messages', async () => {
    // Mock fetch to simulate Anthropic API response
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'GOAL: Navigate to example.com\nPROGRESS: Completed login step.' }],
      }),
    });

    // GetApiKeyFn is synchronous — returns string | null, not a Promise
    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [
      { role: 'user', content: 'Go to example.com and fill out the form' },
      { role: 'assistant', content: 'I will navigate to example.com now.' },
      { role: 'assistant', content: 'I have opened the browser and navigated to example.com.' },
    ];

    const summary = await compactConversation(messages, getApiKey);

    expect(summary).toBeDefined();
    expect(typeof summary).toBe('string');
    expect(summary!.length).toBeGreaterThan(0);

    // Verify fetch was called with Anthropic endpoint
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should return null when API key is unavailable', async () => {
    const getApiKey = vi.fn().mockReturnValue(null);
    const messages = [{ role: 'user', content: 'test' }];

    const summary = await compactConversation(messages, getApiKey);
    expect(summary).toBeNull();
  });

  it('should return null when API call fails', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [{ role: 'user', content: 'test' }];

    const summary = await compactConversation(messages, getApiKey);
    expect(summary).toBeNull();
  });

  it('should return null when API returns non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [{ role: 'user', content: 'test' }];

    const summary = await compactConversation(messages, getApiKey);
    expect(summary).toBeNull();
  });

  it('should return null when API returns empty content', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });

    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [{ role: 'user', content: 'test' }];

    const summary = await compactConversation(messages, getApiKey);
    expect(summary).toBeNull();
  });

  it('should return null when API response content has no text field', async () => {
    // Simulates an unexpected response shape — e.g., image-only content block
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'image', source: { data: 'base64...' } }],
      }),
    });

    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [{ role: 'user', content: 'test' }];

    const summary = await compactConversation(messages, getApiKey);
    expect(summary).toBeNull();
  });

  it('should format conversation messages as [ROLE]: content in the API request body', async () => {
    // Verify the actual payload sent to the Anthropic API includes formatted conversation
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Summary' }],
      }),
    });

    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [
      { role: 'user', content: 'Navigate to example.com' },
      { role: 'assistant', content: 'Opening browser.' },
      { role: 'tool', content: 'Screenshot captured.' },
    ];

    await compactConversation(messages, getApiKey);

    // Extract the body from the fetch call
    const fetchCall = fetchMock.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    const userMessage = body.messages[0].content;

    // All three roles should appear, uppercased
    expect(userMessage).toContain('[USER]: Navigate to example.com');
    expect(userMessage).toContain('[ASSISTANT]: Opening browser.');
    expect(userMessage).toContain('[TOOL]: Screenshot captured.');
  });

  it('should call getApiKey with "anthropic" provider', async () => {
    const getApiKey = vi.fn().mockReturnValue(null);
    const messages = [{ role: 'user', content: 'test' }];

    await compactConversation(messages, getApiKey);

    expect(getApiKey).toHaveBeenCalledWith('anthropic');
  });

  it('should use haiku model and compaction system prompt', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Summary' }],
      }),
    });

    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    await compactConversation([{ role: 'user', content: 'test' }], getApiKey);

    const fetchCall = fetchMock.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);

    expect(body.model).toBe('claude-3-5-haiku-latest');
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toContain('Summarize this computer-use agent conversation');
    expect(body.system).toContain('GOAL');
    expect(body.system).toContain('BROWSER STATE');
  });
});
