import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compactConversation } from '../../../src/services/summarizer.js';

describe('compactConversation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return a summary string when given conversation messages', async () => {
    // Mock fetch to simulate Anthropic API response
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'GOAL: Navigate to example.com\nPROGRESS: Completed login step.' }],
      }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

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
    expect(global.fetch).toHaveBeenCalledWith(
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
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [{ role: 'user', content: 'test' }];

    const summary = await compactConversation(messages, getApiKey);
    expect(summary).toBeNull();
  });

  it('should return null when API returns non-ok response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [{ role: 'user', content: 'test' }];

    const summary = await compactConversation(messages, getApiKey);
    expect(summary).toBeNull();
  });

  it('should return null when API returns empty content', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ content: [] }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const getApiKey = vi.fn().mockReturnValue('test-api-key');
    const messages = [{ role: 'user', content: 'test' }];

    const summary = await compactConversation(messages, getApiKey);
    expect(summary).toBeNull();
  });
});
