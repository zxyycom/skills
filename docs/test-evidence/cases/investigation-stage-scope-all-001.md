### Case INVESTIGATION-STAGE-SCOPE-ALL-001: stage --scope all writes the index projection, report, and owner tree atomically

Tests:
- `test:4663feccffbb111620ddc44318c917f32bb9a3c9232511b0403bd8a0d3d446a7`

Tags:
- `investigation-report`

Contract:
- all scope 在一次原子替换中写入索引投影、报告与完整 owner 树。

Proves:
- pending 索引只含所选条目更新，报告与资源变化同时进入；未选报告无 cached 差异，callerOwnedPaths 为空。
