### Case INVESTIGATION-STAGE-VERSION-CONTROL-001: stage --scope index reports unavailable version control without working-tree writes

Tests:
- `test:c8fbe0bcb5513ac8bbbdf9307368ce6546cd21453abd543ec77596bf87004af6`

Tags:
- `investigation-report`

Contract:
- 选择性暂存要求可用版本仓库，失败时不改写工作树。

Proves:
- 非 Git fixture 返回错误，报告 Markdown 与派生 index 的完整字节保持不变。
