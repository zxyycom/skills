### Case CHANGE-PLAN-METADATA-WRITER-001: Metadata writer 只写规范 Draft 与 Plan

Tests:
- `test:b7ff40ca9733f34488177a2c37864d0e498188a40e9c80615e814684c6b120ed`

Tags:
- `change-plan`

Contract:
- Metadata writer 通过规范 parser 后，以同目录完整临时文件发布 Draft 或 Plan。

Proves:
- 写入后 reader 恢复相同规范对象。
- Plan JSON 只包含 baseCommit 与 stage，并使用稳定格式。
- 发布重命名失败时保留原 metadata，且不遗留本次临时文件。
