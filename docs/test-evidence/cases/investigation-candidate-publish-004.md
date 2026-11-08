### Case INVESTIGATION-CANDIDATE-PUBLISH-004: 候选批次目标与最终图校验

Tests:
- `test:a97daa69dcfb245f6db5388face050a73befaf5622b5ccf410ee091978e47452`

Tags:
- `investigation-report`

Contract:
- 调查候选批量发布计划允许同批目标，并要求目标存在及最终图校验通过。

Proves:
- 选中候选引用同批另一候选时计划通过；仅选引用者返回 MissingTarget，最终图回调失败返回 FinalGraph。
