### Case SKILL-RELEASE-PUBLISH-003: 快照发布拒绝冲突资产
Entry:
- `scripts/publish-skills.test.ts > snapshot publication rejects conflicting assets without remote writes`
- `bun test --test-name-pattern="^snapshot publication rejects conflicting assets without remote writes$" ./scripts/publish-skills.test.ts`
Contract:
- 同名不可变快照的任一资产身份与当前制品不同时，发布必须失败且不得自动覆盖或删除远端内容。
Proves:
- SHA-256 digest 不一致时 CLI 以非零状态退出，并在诊断中指出快照资产冲突和 digest 差异。
- 冲突路径只读取一次 Release 状态，不执行远端写命令。
