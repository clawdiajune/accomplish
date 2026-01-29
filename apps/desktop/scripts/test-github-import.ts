// apps/desktop/scripts/test-github-import.ts
// Run with: npx tsx apps/desktop/scripts/test-github-import.ts

import path from 'path';
import fs from 'fs';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'github-test-' + Date.now());
const USER_SKILLS_PATH = path.join(TEST_DIR, 'user-skills');

fs.mkdirSync(USER_SKILLS_PATH, { recursive: true });
console.log('Test directory:', TEST_DIR);

function convertToRawUrl(url: string): string {
  if (url.includes('raw.githubusercontent.com')) return url;

  if (url.includes('github.com') && url.includes('/blob/')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }

  const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(.+)/);
  if (githubMatch) {
    const [, user, repo, filePath] = githubMatch;
    return `https://raw.githubusercontent.com/${user}/${repo}/main/${filePath}`;
  }

  throw new Error('Invalid GitHub URL format');
}

function validateGitHubUrl(url: string): boolean {
  return url.includes('github.com') || url.includes('raw.githubusercontent.com');
}

console.log('\n========== RUNNING TESTS ==========\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    if (fn()) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ ${name}: ${err}`);
    failed++;
  }
}

test('Convert blob URL to raw URL', () => {
  const blobUrl = 'https://github.com/user/repo/blob/main/skills/test/SKILL.md';
  const rawUrl = convertToRawUrl(blobUrl);
  return rawUrl === 'https://raw.githubusercontent.com/user/repo/main/skills/test/SKILL.md';
});

test('Already raw URL unchanged', () => {
  const alreadyRaw = 'https://raw.githubusercontent.com/user/repo/main/SKILL.md';
  return convertToRawUrl(alreadyRaw) === alreadyRaw;
});

test('Validate GitHub URLs', () => {
  return validateGitHubUrl('https://github.com/test/repo') === true &&
         validateGitHubUrl('https://raw.githubusercontent.com/test') === true &&
         validateGitHubUrl('https://example.com/file.md') === false;
});

test('Invalid URL throws error', () => {
  try {
    convertToRawUrl('https://example.com/file.md');
    return false;
  } catch (err) {
    return (err as Error).message.includes('Invalid');
  }
});

test('Simulate skill file save after GitHub download', () => {
  const mockContent = `---
name: imported-skill
description: An imported skill from GitHub
---
# Imported Skill`;

  const skillDir = path.join(USER_SKILLS_PATH, 'imported-skill');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), mockContent);

  const savedContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
  return savedContent.includes('imported-skill');
});

test('Handle different branch names in URL', () => {
  const developUrl = 'https://github.com/user/repo/blob/develop/SKILL.md';
  const rawDevelop = convertToRawUrl(developUrl);
  return rawDevelop.includes('/develop/');
});

// Cleanup
console.log('\n========== CLEANUP ==========');
fs.rmSync(TEST_DIR, { recursive: true });
console.log('Test directory cleaned up');

console.log(`\n========== RESULTS: ${passed} passed, ${failed} failed ==========\n`);
process.exit(failed > 0 ? 1 : 0);
