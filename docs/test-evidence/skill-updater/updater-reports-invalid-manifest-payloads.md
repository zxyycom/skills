### Case SKILL-UPDATER-MANIFEST-PAYLOAD-001: Updater 报告无效 manifest
Entry:
- `tools/skill-updater/tests/run.ts > updater reports invalid manifest payloads`
- `bun test --test-name-pattern="^updater reports invalid manifest payloads$" ./tools/skill-updater/tests/run.ts`
Contract:
- Release manifest 必须在读取 skill 版本前通过 schema 验证。
Proves:
- 缺少 schemaVersion 的 manifest 产生明确结构诊断。
