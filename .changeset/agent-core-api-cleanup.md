---
"@accomplish_ai/agent-core": patch
---

Clean up public API surface and improve encapsulation

- Replace wildcard barrel exports with explicit named exports
- Internalize message batching and proxy lifecycle into TaskManager
- Remove raw database repository functions from public API (use createStorage factory)
- Move better-sqlite3 and node-pty to optional peer dependencies
- Add StorageAPI and SkillsManagerAPI JSDoc documentation
- Fix SpeechServiceOptions.storage type from unknown to SecureStorageAPI
- Remove dead code (unused interfaces, empty functions)
- Add README.md and npm metadata (homepage, bugs, keywords)
- Remove raw TypeScript source and build configs from published files
