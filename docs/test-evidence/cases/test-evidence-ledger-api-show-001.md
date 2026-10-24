### Case TEST-EVIDENCE-LEDGER-API-SHOW-001: show 检测原位来源 revision 漂移

Tests:
- `test:4b1dc4fdfd3d91f5b91b0df6fbb4ef1d85458acb4eb8e731ec3b0ba188d5c1e3`

Tags:
- `test-evidence`

Contract:
- show 必须以索引中的 Case ID 定位权威来源，并在来源已变化时拒绝返回陈旧 Case。

Proves:
- 同步后的 show 返回 access Case 标题；原位追加后 show 返回 index-stale 且 Case=null。
