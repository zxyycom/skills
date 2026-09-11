### Case INDEX-RUNTIME-METADATA-001: 构建类型化元数据并冻结完整索引投影

Tests:
- `test:8a140b1ce5f4c4c65ca9558821c9fa21cd5c00777a5e66a9ad112d4cbb02b669`

Tags:
- `index-runtime`

Contract:
- Metadata 与 state 必须在包含 `{id, metadata}` 的 projection context 中解析；完整 ID-keyed state-only 索引验证接收递归只读快照。

Proves:
- State parser 获得权威对象键与类型化 metadata；索引 record、直接 state entry 与 metadata 均被冻结，而调用方源对象保持可变且不被 Runtime 修改。
