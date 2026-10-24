### Case INVESTIGATION-STRICT-PREPARATION-FACTS-001: 严格事务各阶段独立采集并交接来源事实

Tests:
- `test:201280ab4145d37785622d853e16ea834d2158252717882c4a0cc030b94e9fe2`
- `test:ca700502919d37c015ab9bbf011da68bf143ebe8f2899dbbce050b4b039df69e`
- `test:d05b2e433199f5517761b70d397566528e9af0ee82843b9009681db68c4a7aa7`
- `test:e47af9d8ee498817e19658dbb95dbad3a794d686cab0bb3ac0c4622acebdb1ac`
- `test:ef6aacf8a9ff7eb7575216fc50ce32e8becf9b164ff737c70e9f726c2a85b678`

Tags:
- `investigation-report`

Contract:
- 严格 rename 与正式 discard 在同一次 prepare 内复用真实事务根绑定的安全源字节、身份、完整父链及已验证文档；rename 的 postverify 先重新采集本阶段 layout/来源，再供同阶段消费者共用，不借用 prepare 文档。原生索引 fresh、事务 fresh 与文件保护仍各按自身阶段验收。

Proves:
- 正式和候选 rename 的准备入口中，每份来源打开两次，分别用于首次严格采集与原生索引 freshness；随后 transaction plan 的 guards 及真实变更 write before 与首次 snapshot 对象相同，未变来源不进入实际 writes，仍与原文档对象相同且保留 state。该观察限于准备入口，不声称实际事务 fresh 或 postverify 零读取。
- 正式 discard 到 beforePublish 观察点时，每份来源仍为上述两次打开；执行完成后受保护的未选来源打开数大于二，且操作成功并报告 changed。该计数证明后续独立读取仍发生，不单独分解各次 transaction fresh/postverify 的调用量，也不是 1W 性能结论。
- 直接调用 rename 写后验收时，含正式和候选来源的 fixture 中每份来源打开两次，分别为本阶段完整采集与独立索引 freshness；两个解析消费者取得同一结果对象。该观察不包含整个 rename 事务的读取量。
- 在已构造的提交后 fixture 追加未选来源正文，写后验收仍返回索引陈旧错误，不复用 prepare 文档掩盖后来变化；这些小 fixture 不证明 1W 性能。
