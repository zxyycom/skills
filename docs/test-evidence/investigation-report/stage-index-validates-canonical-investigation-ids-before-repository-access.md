### Case INVESTIGATION-STAGE-DEFINITION-UPGRADE-001: stage-index validates canonical Investigation IDs before repository access

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index validates canonical Investigation IDs before repository access`
- `bun test --test-name-pattern="^stage-index validates canonical Investigation IDs before repository access$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性暂存在访问版本仓库前校验规范 Investigation ID。

Proves:
- 非法 ID 在当前工作区外也返回错误。
