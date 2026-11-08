### Case INVESTIGATION-STAGE-FRESHNESS-001: domain 暂存拒绝所选来源未同步漂移

Tests:
- `test:5ec9254d4340898c199cc9c51d691dd0274789256372c0d07688bf045d9d718c`

Tags:
- `investigation-report`

Contract:
- domain stage 拒绝所选报告相对发布索引的未同步来源变化。

Proves:
- 真实 Git 中 W 正文 title 变化、发布索引保持不变时 domain stage 失败，完整 pending 条目不变；该节点未执行 CLI、全量 check 或 index scope。
