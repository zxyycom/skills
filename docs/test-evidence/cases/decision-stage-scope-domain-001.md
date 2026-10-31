### Case DECISION-STAGE-SCOPE-DOMAIN-001: stage --scope domain writes only formal Markdown and preserves the pending index

Tests:
- `test:1223577c6a08dbc18f78c7193aedb47c209f96125d3ba92e3f050b980d3bc8e9`

Tags:
- `decision-records`

Contract:
- stage --scope domain 只写所选正式 Markdown，pending 索引按当前字节原样保留。

Proves:
- 真实 CLI 的 domain 步骤把所选当前 Markdown 写入 pending，保留先前 index 步骤的完整 pending 索引字节，并报告 domain scope 与 caller-owned 索引路径。
