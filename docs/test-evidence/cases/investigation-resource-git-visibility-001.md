### Case INVESTIGATION-RESOURCE-GIT-VISIBILITY-001: report resource link changes stale the current index

Tests:
- `test:694972a408148dae367d25d7371b7137dcb876da30bcd60e9bb8f6af042b3ca0`

Tags:
- `investigation-report`

Contract:
- 资源链接属于报告 Markdown source；仅资源字节不属于 source revision。

Proves:
- 将报告链接改为另一合法资源后，完整验证报告当前 index 已过期。
