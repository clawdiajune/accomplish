# Sanity Tests

Agent sanity tests that run real tasks against real models with no mocks.

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
# Run all tests (4 tasks x 3 models = 12 tests)
pnpm -F @accomplish/desktop test:sanity

# Run with specific provider only
pnpm -F @accomplish/desktop test:sanity:opus    # Anthropic only
pnpm -F @accomplish/desktop test:sanity:openai  # OpenAI only
pnpm -F @accomplish/desktop test:sanity:google  # Google only

# Quick smoke test (1 task, 1 model)
pnpm -F @accomplish/desktop test:sanity:quick
```

## Test Tasks

1. **Web Scraping**: Scrape Hacker News top 5 stories → CSV
2. **File Download**: Download PDF from web → local file
3. **File Analysis**: Read local file → analyze → write summary
4. **Visual Comparison**: Screenshot two URLs → comparison report

## Output

- Test artifacts: `apps/desktop/sanity-tests/test-results/`
- HTML report: `apps/desktop/sanity-tests/html-report/`
- JSON report: `apps/desktop/sanity-tests/sanity-report.json`
- Agent output files: `~/openwork-sanity-output/`

## Configuration

| Env Variable | Description | Default |
|--------------|-------------|---------|
| `MODEL_FILTER` | Run only one provider (anthropic/openai/google) | All |
| `TASK_FILTER` | Run only one task type | All |
| `SANITY_TIMEOUT` | Test timeout in ms | 300000 (5 min) |
| `SANITY_HEADLESS` | Run headless (for CI) | false |
