// apps/desktop/sanity-tests/tests/file-analysis.sanity.ts
import { test, expect } from '../fixtures';
import { getModelsToTest } from '../utils/models';
import { fileExists, fileContains, SANITY_OUTPUT_DIR } from '../utils/validators';
import { SanityExecutionPage } from '../page-objects';

const models = getModelsToTest();

for (const model of models) {
  test.describe(`File Analysis [${model.displayName}]`, () => {
    test.use({ currentModel: model });

    test('should read local file, analyze, and write summary', async ({ window }) => {
      const homePage = window;
      const executionPage = new SanityExecutionPage(window);

      // Note: input.txt was seeded by globalSetup
      const taskInput = homePage.getByTestId('task-input-textarea');
      await taskInput.fill(
        `Read the file ${SANITY_OUTPUT_DIR}/input.txt, count the words and lines, and write a summary to ${SANITY_OUTPUT_DIR}/analysis.txt`
      );

      // Submit the task
      const submitButton = homePage.getByTestId('task-input-submit');
      await submitButton.click();

      // Wait for navigation to execution page
      await homePage.waitForURL(/\/execution\//);

      // Auto-allow permissions
      await executionPage.autoAllowPermissions();

      // Wait for task to complete
      const status = await executionPage.waitForComplete();
      executionPage.stopAutoAllow();

      // Validate completion
      expect(status).toBe('completed');

      // Validate output file
      expect(fileExists('analysis.txt')).toBe(true);
      // Should contain word count and/or line count
      expect(
        fileContains('analysis.txt', /word|line|count/i)
      ).toBe(true);
    });
  });
}
