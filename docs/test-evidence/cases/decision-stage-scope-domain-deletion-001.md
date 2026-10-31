### Case DECISION-STAGE-SCOPE-DOMAIN-DELETION-001: stage --scope domain writes a deletion for a baseline-only ID without touching the pending index

Tests:
- `test:1223577c6a08dbc18f78c7193aedb47c209f96125d3ba92e3f050b980d3bc8e9`
- `test:70b42cdc11ebed0c409f872e9af8d7d8fd41663c00f045f1c105b8b6a304238a`
- `test:e9629a4062b9ba08b1643e320b474858d97748b7bc886c7ba875ffe390fc6d8c`

Tags:
- `decision-records`

Contract:
- 基线-only ID 在 domain scope 写入正式 Markdown 删除，pending 索引不受影响。

Proves:
- 真实 all stage 删除所选 old 的 pending 正文和投影，保留 retained，并排除未选 replacement。
- 真实 all scope 的组合入口承接所选删除的 Git 运输；另一个真实 CLI index→domain 入口证明 domain 步骤保留先前 pending 索引字节。
