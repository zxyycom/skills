### Case TEST-EVIDENCE-LEDGER-SOURCE-DRIFT-001: 搜索拒绝权威读取期间变化的 Case 源

Tests:
- `test:df29d56637f3e14706ef6ed91fdfdc1f14b859e23397dd2f6ce1f1a278fac347`

Tags:
- `test-evidence`

Contract:
- 搜索打开权威 Case 源时发生变化，必须拒绝该读取结果。

Proves:
- 打开目标源后立即 append 必然造成 mutation；搜索仅返回 `state-index.source-changed` 这一项诊断。
