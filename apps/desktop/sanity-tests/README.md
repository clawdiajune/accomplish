# Sanity Tests

Agent sanity tests that run real tasks against real models with no mocks.

## Test Status

| Test | Status | Notes |
|------|--------|-------|
| File Analysis | **PASSING** | ~40s - Reads file, counts words/lines, writes summary |
| Visual Compare | **PASSING** | ~1m - Screenshots and compares two URLs |
| File Download | FAILING | 5m timeout - Agent gets stuck on permission requests |
| Web Scraping | FAILING | 5m timeout - Agent gets stuck on permission requests |

**Note:** The failing tests are due to an infrastructure issue where the agent's `complete_task` MCP tool is not properly available, causing the agent to get stuck even after completing the actual work.

## Prerequisites

Set the required API keys as environment variables:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=AI...
```

Or create a `.env.sanity` file (gitignored):

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AI...
```

## Running Tests

```bash
# Run all tests (4 tasks x models with available keys)
pnpm -F @accomplish/desktop test:sanity

# Run with specific provider only
MODEL_FILTER=anthropic ANTHROPIC_API_KEY=your-key pnpm -F @accomplish/desktop test:sanity

# Run a specific test
MODEL_FILTER=anthropic ANTHROPIC_API_KEY=your-key npx playwright test --config=sanity-tests/playwright.sanity.config.ts -g "File Analysis"

# View HTML report after running
npx playwright show-report sanity-tests/html-report
```

## Test Tasks

1. **File Analysis**: Read local file -> count words/lines -> write summary
2. **Visual Comparison**: Screenshot two URLs -> comparison report
3. **Web Scraping**: Scrape Hacker News top 5 stories -> CSV (currently timing out)
4. **File Download**: Download PDF from web -> local file (currently timing out)

## Architecture

### Hybrid Completion Detection

Tests use a hybrid approach to detect task completion:
1. Poll for status badge to change to "completed"/"failed"/"stopped"
2. **Also** poll for expected output file with valid content

This allows tests to pass even if the agent completes the actual work but gets stuck on completion signaling (a known issue with the `complete_task` MCP server).

### Key Files

- `fixtures/sanity-app.ts` - Electron app fixture with real API key injection
- `page-objects/ExecutionPage.ts` - Page object with completion detection and permission handling
- `utils/validators.ts` - File existence and content validators
- `utils/models.ts` - Model configuration and API key management

## Output

- Test artifacts: `apps/desktop/sanity-tests/test-results/`
- HTML report: `apps/desktop/sanity-tests/html-report/`
- JSON report: `apps/desktop/sanity-tests/sanity-report.json`
- Agent output files: `~/openwork-sanity-output/`

## Configuration

| Env Variable | Description | Default |
|--------------|-------------|---------|
| `MODEL_FILTER` | Run only one provider (anthropic/openai/google) | All with keys |
| `SANITY_TIMEOUT` | Test timeout in ms | 300000 (5 min) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | (required if testing Anthropic) |
| `OPENAI_API_KEY` | OpenAI API key for GPT models | (required if testing OpenAI) |
| `GOOGLE_API_KEY` | Google API key for Gemini models | (required if testing Google) |

## Known Issues

### complete_task MCP Server Not Available

The agent sometimes reports that `complete_task` tool is not available. This causes the agent to get stuck even after completing the actual work. The hybrid completion detection works around this by also checking for output files.

### Permission Modal Handling

For question-type permission requests, the test auto-allows by:
1. First trying to click an option button if available
2. Otherwise filling the custom response textarea with "yes, proceed"
3. Then clicking the Submit button

This handles both simple permission modals and question-type modals.
