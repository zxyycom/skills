### Case CHANGE-PLAN-CLI-PLAN-NO-HEAD-001: Plan CLI 拒绝没有 HEAD 的仓库
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI plan rejects a repository without HEAD`
- `bun test --test-name-pattern="^CLI plan rejects a repository without HEAD$" ./tools/change-plan/tests/run.ts`
Contract:
- `plan` 必须从命令运行时已有的 HEAD 取得非空 `baseCommit`，失败时不能写入阶段 metadata。
Proves:
- 仓库没有 HEAD 时，JSON 模式在 stdout 返回 `base-commit-unavailable`、保持 stderr 为空，并保持 Draft metadata 字节不变。
