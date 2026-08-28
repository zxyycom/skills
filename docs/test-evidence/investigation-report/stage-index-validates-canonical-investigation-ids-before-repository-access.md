### Case INVESTIGATION-STAGE-DEFINITION-UPGRADE-001: stage-index validates canonical Investigation IDs before repository access

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index validates canonical Investigation IDs before repository access`
- `bun test --test-name-pattern="^stage-index validates canonical Investigation IDs before repository access$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性暂存在访问仓库或工作区前校验规范 Investigation ID。

Proves:
- 对不存在的临时 root 传入路径 ID，返回 invalid-ID 诊断而该 root 不被创建。
