### Case DECISION-SELECTED-VALID-BASELINE-DELETION-001: Selected sync 不将合法基线成员删除误作读取失败

Tests:
- `test:0149b67809feb81b3836816a7233c797ad6846d24709539e81fe7ca5ad9b4e68`

Tags:
- `decision-records`

Contract:
- 只传播真实基线采集/解析失败；合法已解析基线中的已知来源位置缺失按所选删除处理，仍验完整组合图并保持未读发布条目。

Proves:
- 删除所选正式成员后 selected sync 成功移除该索引条目，同时完整保留未选归档条目；缺成员诊断没有触发错误的baseline-failure早退。
