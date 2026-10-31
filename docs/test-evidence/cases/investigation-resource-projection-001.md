### Case INVESTIGATION-RESOURCE-PROJECTION-001: report-owned resources validate exact links and permit shared references

Tests:
- `test:fabd7e7c055d13ac9d4425b94d956810f264b6969dae6a65e2ec52f237538a6a`

Tags:
- `investigation-report`

Contract:
- 资源由唯一 owner report 维护，其他报告可以通过精确链接共享引用。

Proves:
- owner 与 consumer 共同引用同一资源时完整验证成功。
