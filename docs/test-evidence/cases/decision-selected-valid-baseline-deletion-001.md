### Case DECISION-SELECTED-VALID-BASELINE-DELETION-001: Selected sync 不将合法基线成员删除误作读取失败

Tests:
- `test:f80b46fdd89101581edee411b0cb423cdc050eaf6bbb6c9a54df3acfbdcb88d1`

Tags:
- `decision-records`

Contract:
- 只传播真实基线采集/解析失败；合法已解析基线中的来源删除仍由 selected 完整来源与未选保护判定。

Proves:
- 删除所选正式成员后 selected sync 成功移除该索引条目，同时完整保留未选归档条目；缺成员诊断没有触发错误的baseline-failure早退。
