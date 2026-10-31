### Case INVESTIGATION-DISCARD-GIT-001: discard pauses deletion of Git-recorded reports

Tests:
- `test:54a6faa37d432ca39ed222be6de7eaf43502ded9a38e937fe883109a064c331d`

Tags:
- `investigation-report`

Contract:
- 已进入 Git HEAD 的报告或将删除的 owner 资源必须先经显式 `deleteRecordedReport` 确认，暂停路径不得写入。

Proves:
- 已记录报告首次 discard 返回确认状态且文件仍在；确认后删除生效。
