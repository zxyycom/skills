### Case SKILL-UPDATER-HELP-001: Updater 帮助公开稳定 CLI 契约
Entry:
- `tools/skill-updater/tests/run.ts > updater help exposes the public CLI contract`
- `bun test --test-name-pattern="^updater help exposes the public CLI contract$" ./tools/skill-updater/tests/run.ts`
Contract:
- 帮助请求必须成功并说明 updater 的用法与版本比较语义。
Proves:
- CLI 返回 0，帮助文本包含调用方式和远端版本差异说明。
