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
- parser 输出、输入对象、definition 描述符和磁盘文件变化不影响已打开 reader；index 的 state、metadata 和 revision 拒绝写入且公开形状不泄漏查询值。
- 重复 query/get/all 不增加 metadata/state parser、集合 validator 或时间字段提取次数，查询返回原快照的 state；非法查询仍失败，overlay 经解析后只影响本次结果。
- 两个加载入口拒绝非法 metadata、查询字段、完整集合和越界路径，definition identity 或描述符错误不能建立 reader；冻结的非法原始索引仍被原始查询及内存 reader 构造入口拒绝。
- current 打开只读取一次 revision，stale 且 state 畸形时不执行领域解析；重新打开读取新文件，即使 revision 未变也不复用旧 reader。
