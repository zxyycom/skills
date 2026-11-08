### Case INVESTIGATION-STAGE-METADATA-PROJECTION-001: 索引暂存严格核对关系和最终投影

Tests:
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`
- `test:4e572abfeea52b35c3c4bffc062551f60a2a20ffd64dd908e460bd7d795d107a`
- `test:f33c933c17e5acde3da6af37c9c3527783cd4d574dad9ba15d7bc4d4d59a9150`

Tags:
- `investigation-report`

Contract:
- index stage 先选择性组合发布投影，并对最终投影执行领域图校验。

Proves:
- 共享 compose_index 纯测试证明所选增删与未选 pending 投影；IR graph 测试对无 owner 声明、缺失 owner 与环拒绝。
- IR 真实 Git stage_index 节点证明 IR definition 接入；源码的 compose_index 在序列化前调用该 definition.graph。本组合未直接运行关系刚好因选择投影而断链的 IR Git fixture。
