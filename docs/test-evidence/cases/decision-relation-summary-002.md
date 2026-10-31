### Case DECISION-RELATION-SUMMARY-002: Evolve 将 selector 摘要绑定到完整关系集合

Tests:
- `test:0819893b63215460c342b5f95ac01003fada4a803190c6df2a4f5c37c8d65690`

Tags:
- `decision-records`

Contract:
- evolve 的 relation-summary 在 ID-first selector 解析后，只绑定同一完整 replacement 的 target；摘要保留第一个等号后的内容并由索引与 trace 投影。

Proves:
- 真实文件事务将 name selector 解析为正式 Decision ID，在索引保存包含等号的规范摘要。
- 纯 trace 投影在 entry relations 中保留同一摘要；该入口不调用 CLI parser。
