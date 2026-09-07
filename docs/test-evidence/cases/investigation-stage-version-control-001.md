### Case INVESTIGATION-STAGE-VERSION-CONTROL-001: stage-index reports unavailable version control without working-tree writes

Tests:
- `test:83c81a14a2627933f811fe9711bcfcf8a3ed926716a68782fb48d7db3751110f`

Tags:
- `investigation-report`

Contract:
- 选择性暂存要求可用版本仓库，失败时不改写工作树。

Proves:
- 非 Git fixture 返回错误，报告 Markdown 与派生 index 的完整字节保持不变。
