// apps/desktop/sanity-tests/tests/visual-compare.sanity.ts
import { test, expect, SANITY_TIMEOUTS } from '../fixtures';
import { getModelsToTest } from '../utils/models';
import { globalSetup } from '../utils/setup';
import { fileExists, fileContains, SANITY_OUTPUT_DIR } from '../utils/validators';
import { SanityExecutionPage } from '../page-objects';

// Run global setup once
test.beforeAll(() => {
  globalSetup();
});

const models = getModelsToTest();

for (const model of models) {
  test.describe(`Visual Comparison [${model.displayName}]`, () => {
    test.use({ currentModel: model });

    test('should compare two URLs and save report', async ({ window }) => {
      const homePage = window;
      const executionPage = new SanityExecutionPage(window);

      const taskInput = homePage.getByTestId('task-input-textarea');
      await taskInput.fill(
        `Take screenshots of https://example.com and https://example.org, compare them visually, and save a comparison report to ${SANITY_OUTPUT_DIR}/comparison.md - you have full permission to create and write to any files. Do not ask for permission, just do it directly.`
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
        () => fileExists('comparison.md') && fileContains('comparison.md', 'example.com') && fileContains('comparison.md', 'example.org')
      );
      executionPage.stopAutoAllow();

      // Validate completion - either normal completion or file-based completion
      expect(['completed', 'file_created']).toContain(status);

      // Validate output file
      expect(fileExists('comparison.md')).toBe(true);
      // Should mention both URLs
      expect(fileContains('comparison.md', 'example.com')).toBe(true);
      expect(fileContains('comparison.md', 'example.org')).toBe(true);
    });
  });
}
