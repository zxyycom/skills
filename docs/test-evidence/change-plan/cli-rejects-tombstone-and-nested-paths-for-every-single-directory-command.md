### Case CHANGE-PLAN-CLI-005: 单目录命令只接受直接 active Change
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI rejects tombstone and nested paths for every single-directory command`
- `bun test --test-name-pattern="^CLI rejects tombstone and nested paths for every single-directory command$" ./tools/change-plan/tests/run.ts`
Contract:
- `check`、`show`、`plan` 与 `complete` 从目标父目录推导项目约定 Change 根（默认 `changes/`），只接受该根的直接 active member；tombstone children 和嵌套路径不构成公共目标。
Proves:
- `changes/` 与 custom root 的 `.change-plan-tombstones/<member>` 及其额外嵌套 child，以及另一 active Change 内的嵌套目标，都被四个命令拒绝为 `change-directory-not-active-member` 或等价领域失败。
- 所有拒绝目标的 metadata 保持原样；实际 complete 不删除目标或在其推导根下创建 tombstone，show 不读取被拒绝目标内容。
