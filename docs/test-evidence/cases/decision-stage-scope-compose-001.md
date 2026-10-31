### Case DECISION-STAGE-SCOPE-COMPOSE-001: index 与 domain 顺序组合索引和正文快照

Tests:
- `test:1223577c6a08dbc18f78c7193aedb47c209f96125d3ba92e3f050b980d3bc8e9`

Tags:
- `decision-records`

Contract:
- 先 index 后 domain 可组合所选派生索引投影与正式 Markdown，domain 步骤保留先前 pending 索引字节。

Proves:
- 真实 CLI argv 依次执行 index 与 domain，后一步保持先前 pending 索引完整字节，并使所选当前 Markdown 进入 pending。
