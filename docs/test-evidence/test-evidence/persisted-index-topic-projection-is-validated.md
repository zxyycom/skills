### Case TEST-EVIDENCE-INDEX-PROJECTION-VALIDATION-001: 持久化 Topic 投影必须整体一致
Entry:
- `tools/test-evidence/tests/run.ts > persisted metadata, source paths, and topic keys are validated as one projection`
- `bun test --test-name-pattern="^persisted metadata, source paths, and topic keys are validated as one projection$" ./tools/test-evidence/tests/run.ts`
Contract:
- 持久化索引中的 topic metadata、case 源路径与精确 topic 键必须表示同一合法投影。
Proves:
- 篡改 topic 键或把源路径改到未知 topic 后，查询拒绝信任该索引并回退到权威 catalog。
