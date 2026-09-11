### Case TEST-EVIDENCE-LEDGER-API-SYNC-001: 同步 API 区分缺失、写入与当前索引

Tests:
- `test:a712088575ce52c4523cce1923164fbf81bc6e2e1add91da556fbfaaa7534f65`

Tags:
- `test-evidence`

Contract:
- 同步 API 的 check 报告缺失索引，write 仅在需要时更新索引并返回可判定状态。

Proves:
- 缺失、首次写入和重复写入分别返回 index-missing、written 与 unchanged。
