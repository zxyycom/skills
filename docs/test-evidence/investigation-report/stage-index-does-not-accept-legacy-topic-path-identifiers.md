### Case INVESTIGATION-STAGE-RESOURCE-RENAME-001: stage-index does not accept legacy topic path identifiers

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index does not accept legacy topic path identifiers`
- `bun test --test-name-pattern="^stage-index does not accept legacy topic path identifiers$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性暂存只接受 Investigation ID，不接受旧路径式标识。

Proves:
- 带目录前缀的 ID 返回错误。
