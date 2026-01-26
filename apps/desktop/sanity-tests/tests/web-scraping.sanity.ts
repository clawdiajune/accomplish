// apps/desktop/sanity-tests/tests/web-scraping.sanity.ts
import { test, expect, SANITY_TIMEOUTS } from '../fixtures';
import { getModelsToTest, type SanityModel } from '../utils/models';
import { globalSetup } from '../utils/setup';
import { fileExists, countLines, fileContains, SANITY_OUTPUT_DIR } from '../utils/validators';
import { SanityExecutionPage } from '../page-objects';

// Run global setup once
test.beforeAll(() => {
  globalSetup();
});

const models = getModelsToTest();

for (const model of models) {
  test.describe(`Web Scraping [${model.displayName}]`, () => {
    test.use({ currentModel: model });

    test('should scrape Hacker News and save to CSV', async ({ window }) => {
      const homePage = window;
      const executionPage = new SanityExecutionPage(window);

      // Enter the task prompt
      const taskInput = homePage.getByTestId('task-input-textarea');
      await taskInput.fill(
        `Go to Hacker News (https://news.ycombinator.com), get the top 5 stories (title, URL, points), and save them to ${SANITY_OUTPUT_DIR}/hn-top5.csv - you have full permission to create and write to any files. Do not ask for permission, just do it directly.`
      );

      // Submit the task
      const submitButton = homePage.getByTestId('task-input-submit');
      await submitButton.click();

      // Wait for navigation to execution page
      await homePage.waitForURL(/\/execution\//);

      // Auto-allow permissions
      await executionPage.autoAllowPermissions();

      // Wait for task to complete OR for expected file to be created
      // This handles cases where the agent completes the work but gets stuck on completion signaling
      const status = await executionPage.waitForCompleteOrFile(
        SANITY_TIMEOUTS.TASK_COMPLETE,
        () => fileExists('hn-top5.csv') && countLines('hn-top5.csv') >= 5 && fileContains('hn-top5.csv', /title|url|points/i)
      );
      executionPage.stopAutoAllow();

      // Validate completion - either normal completion or file-based completion
      expect(['completed', 'file_created']).toContain(status);

      // Validate output file
      expect(fileExists('hn-top5.csv')).toBe(true);
      expect(countLines('hn-top5.csv')).toBeGreaterThanOrEqual(5); // Header + 5 rows
      expect(fileContains('hn-top5.csv', /title|url|points/i)).toBe(true);
    });
  });
}
