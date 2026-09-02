### Case CHANGE-PLAN-GIT-FAILURE-001: Git 距离传播版本控制访问故障
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance propagates version-control access failures`
- `bun test --test-name-pattern="^git-distance propagates version-control access failures$" ./tools/change-plan/tests/run.ts`

Contract:
- Git 距离模块把仓库访问故障作为版本控制异常传播，`base-unavailable` 只表达可访问仓库中的 revision 不可用。

Proves:
- 对非仓库路径执行检查会拒绝 Promise，并以 `Version-control operation failed`、明确 operation 与 `tool-unavailable` 原因返回当前结构化版本控制错误文本。
