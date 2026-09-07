### Case TEST-EVIDENCE-LEDGER-API-SHOW-001: show 检测来源替换并返回当前权威 Case

Tests:
- `test:6151b76a7790c1e47b252dc936b689ea49509f039035b18ca071d549474aab90`

Tags:
- `test-evidence`

Contract:
- show 必须以索引中的 Case ID 定位权威来源，并在来源已变化时拒绝返回陈旧 Case。

Proves:
- 同步后 show 返回 access Case 标题；随后改写其来源，show 返回 null Case。
