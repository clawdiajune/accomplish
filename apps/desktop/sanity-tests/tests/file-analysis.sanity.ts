// apps/desktop/sanity-tests/tests/file-analysis.sanity.ts
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
  test.describe(`File Analysis [${model.displayName}]`, () => {
    test.use({ currentModel: model });

    test('should read local file, analyze, and write summary', async ({ window }) => {
      const homePage = window;
      const executionPage = new SanityExecutionPage(window);

      // Note: input.txt was seeded by globalSetup
      // The prompt explicitly allows file creation to avoid permission prompts
      const taskInput = homePage.getByTestId('task-input-textarea');
      await taskInput.fill(
        `Read the file ${SANITY_OUTPUT_DIR}/input.txt, count the words and lines. Then write a summary directly to ${SANITY_OUTPUT_DIR}/analysis.txt - you have full permission to create and write to this file.`
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
        () => fileExists('analysis.txt') && fileContains('analysis.txt', /word|line|count/i)
      );
      executionPage.stopAutoAllow();

      // Validate completion - either normal completion or file-based completion
      expect(['completed', 'file_created']).toContain(status);

      // Validate output file
      expect(fileExists('analysis.txt')).toBe(true);
      // Should contain word count and/or line count
      expect(
        fileContains('analysis.txt', /word|line|count/i)
      ).toBe(true);
    });
  });
}
