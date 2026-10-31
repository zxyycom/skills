### Case CHANGE-PLAN-METADATA-WRITER-001: Metadata writer 只写规范 Draft 与 Plan

Tests:
- `test:d270bc22e6ffec5435bdad25c92a7703290b9f1a91d41317cf1895090f2f9f35`

Tags:
- `change-plan`

Contract:
- Metadata writer 通过规范 parser 后，以同目录完整临时文件发布 Draft 或 Plan。

Proves:
- 写入后 reader 恢复相同规范对象。
- Plan JSON 只包含 baseCommit 与 stage，并使用稳定格式。
- 发布重命名失败时保留原 metadata，且不遗留本次临时文件。
