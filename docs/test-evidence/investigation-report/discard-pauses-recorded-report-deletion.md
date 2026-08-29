### Case INVESTIGATION-DISCARD-GIT-001: discard pauses deletion of Git-recorded reports

Entry:
- `tools/investigation-report/tests/discard.test.ts > discard pauses recorded reports until recorded deletion is explicitly confirmed`
- `bun test --test-name-pattern="^discard pauses recorded reports until recorded deletion is explicitly confirmed$" ./tools/investigation-report/tests/run.ts`

Contract:
- 已进入 Git HEAD 的报告或将删除的 owner 资源必须先经显式 `deleteRecordedReport` 确认，暂停路径不得写入。

Proves:
- 已记录报告首次 discard 返回确认状态且文件仍在；确认后删除生效。
