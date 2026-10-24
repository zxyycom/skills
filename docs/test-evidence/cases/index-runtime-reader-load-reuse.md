### Case INDEX-RUNTIME-READER-LOAD-001: 严格加载并复用本次 reader 快照

Tests:
- `test:0b3ef6ec8312c1f18ed3734876364dfde1a7d39e823bcafa17f91691060a72dc`
- `test:4f5e67794ff44803e0a733701d35036465801abad5e904657ae95c0f08a4b9aa`
- `test:cd2c264bc20e024600e774a5468cb4ff56a77f02a75da6e869f6251d390e9ac0`
- `test:d24d6566c477d2103267525d348caf8d2caf6cd303860752e7547eb739580666`

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
