### Case INVESTIGATION-STAGE-INPUT-001: 暂存入口在仓库访问前校验规范主题 ID
Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index validates canonical topic ids before repository access`
- `bun test --test-name-pattern="^stage-index validates canonical topic ids before repository access$" ./tools/investigation-report/tests/run.ts`
Contract:
- `stage-index` 必须先拒绝空选择、非规范 POSIX 主题路径和重复 ID，再规范化调查目录或访问版本仓库。
Proves:
- 不存在的工作区分别收到稳定的 `selection-invalid` 诊断，且命令没有创建工作区或继续访问仓库。
