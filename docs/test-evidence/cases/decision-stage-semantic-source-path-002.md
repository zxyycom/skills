### Case DECISION-STAGE-SEMANTIC-SOURCE-PATH-002: stage ignores an invalid former ID basename after an ID keeps a semantic sourcePath

Tests:
- `test:9fa695f8549bac28a5fd6734f0ae54742cc8d66d1efce869e316ab772d9686a9`

Tags:
- `decision-records`

Contract:
- 已索引的 Decision ID 按独立 sourcePath 选择；同名旧 ID basename 的未选择非法文件不阻断暂存。

Proves:
- 真实 stage 成功保留 semantic-current.md，非法 selected.md 未进入 pending。
