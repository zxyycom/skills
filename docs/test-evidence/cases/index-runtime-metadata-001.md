### Case INDEX-RUNTIME-METADATA-001: 构建类型化元数据并冻结完整索引投影

Tests:
- `test:f4ea1bc8ef09104830483bc9c3b7e0bf03f5ec0f88bc2a8de9277d513865bb1d`

Tags:
- `index-runtime`

Contract:
- Metadata 与 state 必须在包含 `{id, metadata}` 的 projection context 中解析；完整 ID-keyed state-only 索引验证接收递归只读快照。

Proves:
- State parser 获得权威对象键与类型化 metadata；索引 record、直接 state entry 与 metadata 均被冻结，而调用方源对象保持可变且不被 Runtime 修改。
