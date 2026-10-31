### Case INVESTIGATION-STAGE-SCOPE-ALL-001: all scope 写入索引投影报告及 owner 树

Tests:
- `test:163f86afd9fcef1e7e1fe7e3e19d9b5f361b52e9a4d83e87c51e0bafb6413627`

Tags:
- `investigation-report`

Contract:
- all scope 在一次原子替换中写入索引投影、报告与完整 owner 树。

Proves:
- 成功 stage 的 pending 索引只更新所选条目；报告标题与改/增资源的 blob 为明确预期字节，未选报告无 cached 差异，callerOwnedPaths 为空；该成功路径不单独证明失败原子性。
