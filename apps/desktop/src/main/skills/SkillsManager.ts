// apps/desktop/src/main/skills/SkillsManager.ts

/**
 * Desktop-specific SkillsManager wrapper.
 *
 * This module wraps the core SkillsManager with Electron-specific path resolution
 * using `app.getPath()` and `app.isPackaged`.
 */

import { app } from 'electron';
import path from 'path';
import { SkillsManager as CoreSkillsManager } from '@accomplish/core';
import { getDatabase } from '../store/db';

/**
 * Get the bundled skills directory path.
 * These are user-facing skills bundled with the app.
 * In dev: apps/desktop/bundled-skills
 * In packaged: resources/bundled-skills
 */
function getBundledSkillsPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bundled-skills');
  }
  return path.join(app.getAppPath(), 'bundled-skills');
}

/**
 * Get the user skills directory path.
 */
function getUserSkillsPath(): string {
  return path.join(app.getPath('userData'), 'skills');
}

/**
 * Desktop-specific SkillsManager that wraps the core implementation.
 * Provides Electron-specific path resolution and lazy initialization.
 */
export class SkillsManager {
  private coreManager: CoreSkillsManager | null = null;
  private initialized = false;

  /**
   * Get the bundled skills path (for backward compatibility).
   */
  getBundledSkillsPath(): string {
    return getBundledSkillsPath();
  }

  /**
   * Get the user skills path (for backward compatibility).
   */
  getUserSkillsPath(): string {
    return getUserSkillsPath();
  }

  /**
   * Get or create the core SkillsManager instance.
   * Initializes with Electron-specific paths and the database instance.
   */
  private getCoreManager(): CoreSkillsManager {
    if (!this.coreManager) {
      this.coreManager = new CoreSkillsManager({
        bundledSkillsPath: getBundledSkillsPath(),
        userSkillsPath: getUserSkillsPath(),
        database: getDatabase(),
      });
    }
    return this.coreManager;
  }

  /**
   * Initialize the skills manager.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[SkillsManager] Initializing...');
    await this.getCoreManager().initialize();
    this.initialized = true;
    console.log('[SkillsManager] Initialized');
  }

  /**
   * Resync skills from disk to database.
   */
  async resync(): Promise<void> {
    console.log('[SkillsManager] Resyncing skills...');
    await this.getCoreManager().resync();
  }

  /**
   * Get all skills.
   */
  async getAll() {
    return this.getCoreManager().getAllSkills();
  }

  /**
   * Get enabled skills.
   */
  async getEnabled() {
    return this.getCoreManager().getEnabledSkills();
  }

  /**
   * Set skill enabled state.
   */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    this.getCoreManager().setSkillEnabled(id, enabled);
  }

  /**
   * Get skill content.
   */
  async getContent(id: string): Promise<string | null> {
    return this.getCoreManager().getSkillContent(id);
  }

  /**
   * Add a skill from a file path or URL.
   */
  async addFromFile(sourcePath: string) {
    return this.getCoreManager().addSkill(sourcePath);
  }

  /**
   * Add a skill from a GitHub URL.
   */
  async addFromGitHub(rawUrl: string) {
    return this.getCoreManager().addSkill(rawUrl);
  }

  /**
   * Delete a skill.
   */
  async delete(id: string): Promise<void> {
    const deleted = this.getCoreManager().deleteSkill(id);
    if (!deleted) {
      throw new Error('Skill not found or cannot be deleted');
    }
  }
}

/**
 * Singleton instance of the desktop SkillsManager.
 */
export const skillsManager = new SkillsManager();
