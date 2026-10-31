### Case INVESTIGATION-RESOURCE-GIT-VISIBILITY-001: report resource link changes stale the current index

Tests:
- `test:ca02d8e6297e2631b002c5641800a4cb05c26ac0c77254686f628dd8f988f046`

Tags:
- `investigation-report`

Contract:
- 资源链接属于报告 Markdown source；仅资源字节不属于 source revision。

Proves:
- 将报告链接改为另一合法资源后，完整验证报告当前 index 已过期。
