### Case DECISION-STAGE-SCOPE-INDEX-001: stage --scope index writes only the derived index projection

Tests:
- `test:1223577c6a08dbc18f78c7193aedb47c209f96125d3ba92e3f050b980d3bc8e9`

Tags:
- `decision-records`

Contract:
- stage --scope index 只把所选记录的派生索引投影写入 pending，不写正式 Decision Markdown。

Proves:
- 真实 CLI 的 index 步骤暂存路径只有 decision-index.json，不夹带已修改的正式 Markdown。
