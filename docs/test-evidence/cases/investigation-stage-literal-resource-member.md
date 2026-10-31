### Case INVESTIGATION-STAGE-LITERAL-RESOURCE-MEMBER-001: 完整资源树保留普通未引用文件名

Tests:
- `test:5acd86bd0bdc73a4512a5d2b87f19217bdaf5c49f5148d0e6b44eb52d6e325bc`

Tags:
- `investigation-report`

Contract:
- 未引用 owner 树成员按安全普通文件路径暂存和删除；直接引用资源 ID 的字符规则只约束引用 ID。

Proves:
- 名称含空格的普通未引用成员能成功更新 pending 字节，删除后能成功暂存该基线资源删除。
