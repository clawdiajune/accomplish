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
  async waitForComplete(timeout = SANITY_TIMEOUTS.TASK_COMPLETE): Promise<'completed' | 'failed' | 'stopped'> {
    await this.page.waitForFunction(
      () => {
        const badge = document.querySelector('[data-testid="execution-status-badge"]');
        if (!badge) return false;
        const text = badge.textContent?.toLowerCase() || '';
        return text.includes('completed') || text.includes('failed') || text.includes('stopped');
      },
      { timeout }
    );

    const badgeText = await this.statusBadge.textContent();
    if (badgeText?.toLowerCase().includes('completed')) return 'completed';
    if (badgeText?.toLowerCase().includes('failed')) return 'failed';
    return 'stopped';
  }

  /**
   * Auto-allow any permission requests during execution.
   * Polls for permission modals and clicks allow.
   */
  async autoAllowPermissions(): Promise<void> {
    // Set up a recurring check for permission modals
    const checkAndAllow = async () => {
      try {
        const modal = this.page.getByTestId('execution-permission-modal');
        if (await modal.isVisible({ timeout: 100 })) {
          await this.allowButton.click();
        }
      } catch {
        // No modal visible, continue
      }
    };

    // Check every second during execution
    const interval = setInterval(checkAndAllow, 1000);

    // Return cleanup function
    return new Promise((resolve) => {
      // Store interval for cleanup later
      (this as unknown as { _permissionInterval: NodeJS.Timeout })._permissionInterval = interval;
      resolve();
    });
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
}
