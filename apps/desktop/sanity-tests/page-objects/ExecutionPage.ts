// apps/desktop/sanity-tests/page-objects/ExecutionPage.ts
import type { Page } from '@playwright/test';
import { SANITY_TIMEOUTS } from '../fixtures/sanity-app';

/**
 * Page object for the Execution page in sanity tests.
 * Extended timeout support for real agent execution.
 */
export class SanityExecutionPage {
  constructor(private page: Page) {}

  get statusBadge() {
    return this.page.getByTestId('execution-status-badge');
  }

  get messagesContainer() {
    return this.page.getByTestId('messages-scroll-container');
  }

  get permissionModal() {
    return this.page.getByTestId('execution-permission-modal');
  }

  get allowButton() {
    return this.page.getByTestId('permission-allow-button');
  }

  /**
   * Wait for task to complete (success or failure).
   * Uses extended timeout for real agent work.
   */
  async waitForComplete(timeout = 300000): Promise<'completed' | 'failed' | 'stopped'> {
    // Default to 5 minutes (300000ms) for real agent work
    const effectiveTimeout = timeout || 300000;
    console.log(`[SanityExecutionPage] waitForComplete with timeout: ${effectiveTimeout}ms`);

    // waitForFunction signature: (pageFunction, arg, options)
    // Pass undefined as arg since our function takes no arguments
    await this.page.waitForFunction(
      () => {
        const badge = document.querySelector('[data-testid="execution-status-badge"]');
        if (!badge) return false;
        const text = badge.textContent?.toLowerCase() || '';
        return text.includes('completed') || text.includes('failed') || text.includes('stopped');
      },
      undefined,
      { timeout: effectiveTimeout }
    );

    const badgeText = await this.statusBadge.textContent();
    if (badgeText?.toLowerCase().includes('completed')) return 'completed';
    if (badgeText?.toLowerCase().includes('failed')) return 'failed';
    return 'stopped';
  }

  /**
   * Auto-allow any permission requests during execution.
   * Polls for permission modals and clicks allow.
   * Handles both standard permissions and question-type requests.
   */
  async autoAllowPermissions(): Promise<void> {
    // Set up a recurring check for permission modals
    const checkAndAllow = async () => {
      try {
        // Check for the permission modal
        const modal = this.page.getByTestId('execution-permission-modal');
        const isModalVisible = await modal.isVisible().catch(() => false);

        if (isModalVisible) {
          console.log('[SanityExecutionPage] Permission modal detected');

          // Check for allow/submit button
          const allowButton = this.page.getByTestId('permission-allow-button');
          const isAllowVisible = await allowButton.isVisible().catch(() => false);

          if (isAllowVisible) {
            // Check if button is disabled (question-type needs input first)
            const isDisabled = await allowButton.isDisabled().catch(() => false);

            if (isDisabled) {
              console.log('[SanityExecutionPage] Submit button disabled, looking for question input...');

              // For question-type requests, we need to either:
              // 1. Click an option button, or
              // 2. Fill in the custom response textarea

              // First, try to click the first option button if available
              const optionButton = modal.locator('button.w-full.text-left').first();
              const hasOption = await optionButton.isVisible().catch(() => false);

              if (hasOption) {
                await optionButton.click();
                console.log('[SanityExecutionPage] Clicked first option button');
                // Small delay to let UI update
                await this.page.waitForTimeout(100);
              } else {
                // Otherwise, fill in custom response textarea
                const textarea = modal.locator('textarea[aria-label="Custom response"]');
                const hasTextarea = await textarea.isVisible().catch(() => false);

                if (hasTextarea) {
                  await textarea.fill('yes, proceed');
                  console.log('[SanityExecutionPage] Filled custom response textarea');
                  // Small delay to let UI update
                  await this.page.waitForTimeout(100);
                }
              }
            }

            // Now try to click the allow/submit button
            const canClick = !(await allowButton.isDisabled().catch(() => true));
            if (canClick) {
              await allowButton.click();
              console.log('[SanityExecutionPage] Clicked allow/submit button');
            }
          } else {
            // Try clicking any button that says "Allow" or "Yes" or "OK" or "Submit"
            const anyAllowButton = this.page.locator('button').filter({ hasText: /allow|yes|ok|approve|submit/i }).first();
            if (await anyAllowButton.isVisible().catch(() => false)) {
              await anyAllowButton.click();
              console.log('[SanityExecutionPage] Clicked generic allow button');
            }
          }
        }
      } catch (e) {
        // Ignore errors - modal might have disappeared
        console.log('[SanityExecutionPage] Permission check error:', e);
      }
    };

    // Check more frequently (every 500ms)
    const interval = setInterval(checkAndAllow, 500);

    // Store interval for cleanup later
    (this as unknown as { _permissionInterval: NodeJS.Timeout })._permissionInterval = interval;

    // Run initial check immediately
    await checkAndAllow();
  }

  /**
   * Stop permission auto-allow polling.
   */
  stopAutoAllow(): void {
    const interval = (this as unknown as { _permissionInterval?: NodeJS.Timeout })._permissionInterval;
    if (interval) {
      clearInterval(interval);
    }
  }

  /**
   * Get the current status text.
   */
  async getStatus(): Promise<string> {
    return (await this.statusBadge.textContent()) || '';
  }

  /**
   * Wait for task completion or for expected output file to exist.
   * Returns early if the file is created and validates, allowing tests to pass
   * even if the agent gets stuck on completion signaling.
   */
  async waitForCompleteOrFile(
    timeout: number,
    fileValidator: () => boolean
  ): Promise<'completed' | 'failed' | 'stopped' | 'file_created'> {
    const effectiveTimeout = timeout || 300000;
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds

    console.log(`[SanityExecutionPage] waitForCompleteOrFile with timeout: ${effectiveTimeout}ms`);

    while (Date.now() - startTime < effectiveTimeout) {
      // Check if status badge indicates completion
      try {
        const badge = await this.page.$('[data-testid="execution-status-badge"]');
        if (badge) {
          const text = (await badge.textContent())?.toLowerCase() || '';
          if (text.includes('completed')) return 'completed';
          if (text.includes('failed')) return 'failed';
          if (text.includes('stopped')) return 'stopped';
        }
      } catch (e) {
        // Ignore errors
      }

      // Check if expected file was created
      try {
        if (fileValidator()) {
          console.log('[SanityExecutionPage] Expected file found, considering task complete');
          return 'file_created';
        }
      } catch (e) {
        // File not ready yet
      }

      await this.page.waitForTimeout(pollInterval);
    }

    throw new Error(`Timeout waiting for task completion (${effectiveTimeout}ms)`);
  }
}
