### Case CHANGE-PLAN-CHECK-VC-001: 检查区分 Git 故障与不可用基线

Tests:
- `test:2141ff704cd2f0191d29aefe3bec1f189900db82b89157b2f4c4f47bf4bbed88`

Tags:
- `change-plan`

Contract:
- Plan 检查分别使用 `version-control-failed` 表达 Git 访问故障、使用 `base-commit-unavailable` 表达基线不可用。

Proves:
- 损坏的 Git 访问返回 `version-control-failed` 且没有距离证据。
- 同一结果只包含 Git 访问故障诊断，不包含基线不可用诊断。
