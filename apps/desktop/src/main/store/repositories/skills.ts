// apps/desktop/src/main/store/repositories/skills.ts

/**
 * Re-export skills repository from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  getAllSkills,
  getEnabledSkills,
  getSkillById,
  upsertSkill,
  setSkillEnabled,
  deleteSkill,
  clearAllSkills,
} from '@accomplish/core';
