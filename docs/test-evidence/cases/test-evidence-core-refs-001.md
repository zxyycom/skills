### Case TEST-EVIDENCE-CORE-REFS-001: 引用验证区分快照状态并允许未引用实体

Tests:
- `test:3934b75b22ea611610355685ff8d4b3b6fa06f83e0890439328194d7d9a3498a`

Tags:
- `test-evidence`

Contract:
- 完整快照与预期来源一致后才检查 Case 引用；partial 和缺失引用阻断，未引用实体及空 Case 集合中的空完整快照合法。

Proves:
- 完整快照返回引用数；partial 和缺失实体分别得到阻断状态，而额外实体不导致失败；空 Case 集合配合空完整快照返回 valid。
