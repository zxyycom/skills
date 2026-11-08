### Case DECISION-SYNC-INDEX-CLI-OPTIONS-001: Selected sync 失败保留配置索引路径

Tests:
- `test:e20cd326c2892c0898cf5bdabfcab764770420b5e3eb48ad1dc8e015da363bd5`

Tags:
- `decision-records`

Contract:
- sync-index selected 支持预检与正式调用，并在失败结果中标识配置的索引路径。

Proves:
- 真实 CLI 对默认和自定义目录的 selected sync，预检与正式调用在缺失索引时均返回失败和相应相对索引路径。
