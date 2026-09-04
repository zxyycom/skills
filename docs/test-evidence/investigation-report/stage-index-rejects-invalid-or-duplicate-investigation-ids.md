### Case INVESTIGATION-STAGE-INPUT-001: stage-index rejects invalid or duplicate Investigation IDs

Entry:

- `tools/investigation-report/tests/staging.test.ts > stage-index rejects invalid or duplicate Investigation IDs`
- `bun test --test-name-pattern="^stage-index rejects invalid or duplicate Investigation IDs$" ./tools/investigation-report/tests/run.ts`

Contract:

- `stage-index` 拒绝重复或非 extensionless Investigation ID。

Proves:

- 重复 ID 返回 duplicate 诊断；路径、`./` 和首尾空白 ID 各返回明确 extensionless 契约的 invalid 诊断。
