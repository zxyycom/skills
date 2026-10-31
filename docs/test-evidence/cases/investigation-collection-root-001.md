### Case INVESTIGATION-COLLECTION-ROOT-001: full validation rejects unknown investigation root members

Tests:
- `test:a9459009080cc7cf2caf6a5ea0b8099037cdf23fa8ca3c4c074a4cffdabe90dd`

Tags:
- `investigation-report`

Contract:
- 平铺 Investigation Report 根目录只允许规范报告、派生 index 和 `_resources/`。

Proves:
- 未知根文件返回其必须为根级 Investigation ID Markdown 文件的可行动诊断。
