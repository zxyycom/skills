### Case INVESTIGATION-COLLECTION-ROOT-001: full validation rejects unknown investigation root members

Tests:
- `test:27ddce8a4aad2b2e6dca10eecd09d719db3050790c94865fbde55a8decb60508`

Tags:
- `investigation-report`

Contract:
- 平铺 Investigation Report 根目录只允许规范报告、派生 index 和 `_resources/`。

Proves:
- 未知根文件返回其必须为根级 Investigation ID Markdown 文件的可行动诊断。
