### Case TEST-EVIDENCE-LEDGER-API-SHOW-001: show 检测来源替换并返回当前权威 Case

Tests:
- `test:25033a05ccf872e620f16c36b6c54dbe64f2ecc4379e4228484dbb8558c7b4e9`

Tags:
- `test-evidence`

Contract:
- show 必须以索引中的 Case ID 定位权威来源，并在来源已变化时拒绝返回陈旧 Case。

Proves:
- 同步后 show 返回 access Case 标题；随后改写其来源，show 返回 null Case。
