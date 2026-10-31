### Case INDEX-RUNTIME-READER-LOAD-001: 严格加载并复用本次 reader 快照

Tests:
- `test:81a4a0bd543a1c734dde0db942e50f968454e6d12677709924f6028eb42980b2`
- `test:a09cef534acb57955c8910d560496c7113603b9336312da056c8f57f1b92344e`
- `test:c3c1cc68b96a5339172ef30a08ac1e768bede75b85160a4fdc787f839f39ff28`
- `test:c830ca3c7d1083e761e9d0d6195c5eca818d1a72f4024c5b3d202b052159aa57`

Tags:
- `index-runtime`

Contract:
- loadStateIndexReader 与 loadCurrentStateIndexReader 在严格加载边界内建立 reader；reader.index 是与调用方和 parser 输出隔离的递归只读快照，同一 reader 的读取复用静态查询物化，不绕过查询或 overlay 校验。
- current reader 每次打开读取一次 revision，stale 优先于领域解析失败；打开后保持绑定快照，后续打开重新读取文件，不跨调用缓存索引。

Proves:
- parser 输出、输入对象、definition 描述符与磁盘变化不影响已打开 reader；state/metadata/revision 拒绝写入且不泄漏查询值。
- 重复 query/get/all 不增加 fixture parser、validator 或读取次数；overlay 仅解析本次变化并保持原 reader 结果。
- 两个加载入口拒绝非法 metadata、查询字段、完整集合与越界路径；非法 definition 或冻结 raw 索引不能绕过校验。
- current 打开读取一次 revision，stale 优先于 state 解析；再次打开读取新文件，不跨调用复用旧 reader。
