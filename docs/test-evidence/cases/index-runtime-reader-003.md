### Case INDEX-RUNTIME-READER-003: 以一次修订检查打开绑定 reader

Tests:
- `test:db6222745bb7d8253082ca0f600ff21094376d9d7e4b5fb6ff76ca5c952e0521`

Tags:
- `index-runtime`

Contract:
- Runtime open 先用一次结构化来源 revision 排除 stale snapshot，再严格解析 current snapshot、验证完整集合并把静态查询值缓存到 reader；随后 `all`、`get` 与 `query` 共享同一不可变视图。

Proves:
- Open 只读取一次 revision，不执行完整领域 source read；静态 state parser 与集合 validator 只在建立 reader 时执行，后三类读取不重复这些步骤。
- 非法 get ID 返回 `state-index.query-invalid`，不进入对象查找。
