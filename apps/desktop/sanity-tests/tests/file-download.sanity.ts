// apps/desktop/sanity-tests/tests/file-download.sanity.ts
import { test, expect, SANITY_TIMEOUTS } from '../fixtures';
import { getModelsToTest } from '../utils/models';
import { globalSetup } from '../utils/setup';
import { fileExists, getFileSize, SANITY_OUTPUT_DIR } from '../utils/validators';
import { SanityExecutionPage } from '../page-objects';

// Run global setup once
test.beforeAll(() => {
  globalSetup();
});

const models = getModelsToTest();

for (const model of models) {
  test.describe(`File Download [${model.displayName}]`, () => {
    test.use({ currentModel: model });

    test('should download PDF from web and save locally', async ({ window }) => {
      const homePage = window;
      const executionPage = new SanityExecutionPage(window);

      // Enter the task prompt
      const taskInput = homePage.getByTestId('task-input-textarea');
      await taskInput.fill(
        `Download the PDF from https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf and save it to ${SANITY_OUTPUT_DIR}/downloaded.pdf - you have full permission to create and write to any files. Do not ask for permission, just do it directly.`
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
        () => fileExists('downloaded.pdf') && getFileSize('downloaded.pdf') > 1024
      );
      executionPage.stopAutoAllow();

      // Validate completion - either normal completion or file-based completion
      expect(['completed', 'file_created']).toContain(status);

      // Validate output file
      expect(fileExists('downloaded.pdf')).toBe(true);
      expect(getFileSize('downloaded.pdf')).toBeGreaterThan(1024); // > 1KB
    });
  });
}
