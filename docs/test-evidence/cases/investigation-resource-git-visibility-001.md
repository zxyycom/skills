### Case INVESTIGATION-RESOURCE-GIT-VISIBILITY-001: report resource link changes stale the current index

Tests:
- `test:fed4491bac9a037ab05fa2c031fc29254b6127153d2342da02331fa7a2e69203`

Tags:
- `investigation-report`

Contract:
- 资源链接属于报告 Markdown source；仅资源字节不属于 source revision。

Proves:
- 两份资源均存在时，仅将报告链接改为另一合法资源，完整 check 返回 index-not-current 且索引字节不变；恢复链接后仅修改资源字节，同步返回 unchanged。
