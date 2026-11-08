### Case DECISION-RELATION-SUMMARY-002: Evolve 将 selector 摘要绑定到完整关系集合

Tests:
- `test:b770d083e5425c18302bee8766c0d49b62f8dfd1affddc705457963dcfa35922`

Tags:
- `decision-records`

Contract:
- evolve 的 relation-summary 在 ID-first selector 解析后，只绑定同一完整 replacement 的 target；摘要保留第一个等号后的内容并由索引与 trace 投影。

Proves:
- 原生文件事务将关系 name 与摘要完整 ID 解析到同一正式对象，索引保存 trim 后且包含等号的摘要。
- 同次索引的 trace 投影保留该摘要；该节点不调用 CLI parser。
