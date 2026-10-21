### Case DECISION-STAGE-SCOPE-COMPOSE-001: index 与 domain 顺序组合索引和正文快照

Tests:
- `test:dca3fbd723a76c5f76404de687ea00ed30673148c224a57535df8b257684c1ee`

Tags:
- `decision-records`

Contract:
- 先 index 后 domain 可组合所选派生索引投影与正式 Markdown，domain 步骤保留先前 pending 索引字节。

Proves:
- 真实 CLI argv 依次执行 index 与 domain，后一步保持先前 pending 索引完整字节，并使所选当前 Markdown 进入 pending。
