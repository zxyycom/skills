### Case INDEX-RUNTIME-RUNTIME-OVERLAY-001: 合并运行时状态且不修改持久化条目

Tests:
- `test:b46f451fe97d000261300168806f8f814e4a43cbf55f9784590f7225f7ea55c2`

Tags:
- `index-runtime`

Contract:
- 运行时状态按合法 ID record 覆盖 reader 的内存查询视图，经同一字段提取规则物化，不得回写 state-only 持久索引；数组型 overlay 容器不兼容。

Proves:
- Overlay state 的查询字段值能够命中过滤，而原持久 state 保持不变且公开 entry 不暴露查询值。
- 非 record 的 runtime states 返回 `state-index.runtime-states-invalid`。
- 带首尾空白的 overlay ID 返回 `state-index.id-invalid`。
