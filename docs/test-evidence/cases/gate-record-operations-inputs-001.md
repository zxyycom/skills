### Case GATE-RECORD-OPERATIONS-INPUTS-001: 共同记录操作变更激活真实消费者

Tests:
- `test:ffb34341894dd0fd382e8a8349a66f0486840849e3a731173214f7fcdb725f77`

Tags:
- `vibe-gate`

Contract:
- 共同记录操作是已知输入owner，变更需激活两域真实消费者而不扩大无关领域。

Proves:
- 共同 query/sync/candidate 运行时修改使两域实际 query/maintenance consumer execute，Index Runtime、Task Graph、Novel Cards 独立检查 reuse；成功发布后相同输入 warm 无新增激活。
