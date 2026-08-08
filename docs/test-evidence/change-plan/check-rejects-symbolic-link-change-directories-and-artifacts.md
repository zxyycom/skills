### Case CHANGE-PLAN-CHECK-SYMLINK-001: 检查拒绝符号链接目录与 artifact
Entry:
- `tools/change-plan/tests/check.test.ts > check rejects symbolic-link change directories and artifacts`
- `bun test --test-name-pattern="^check rejects symbolic-link change directories and artifacts$" ./tools/change-plan/tests/run.ts`
Contract:
- Change 目录必须是真实目录，必需 artifact 必须是普通文件；检查器不跟随这些固定路径上的符号链接。
Proves:
- 指向 Change 的目录链接得到 `change-path-not-directory`，链接到外部文件的 `design.md` 得到 `required-path-not-file`，且目录不可检查时 assessment 为空。
