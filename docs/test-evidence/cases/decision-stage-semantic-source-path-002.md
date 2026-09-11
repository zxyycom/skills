### Case DECISION-STAGE-SEMANTIC-SOURCE-PATH-002: stage ignores an invalid former ID basename after an ID keeps a semantic sourcePath

Tests:
- `test:4351e3c8a1fc1613fd370eb6d3a9b9c35363c652d64cee55a18b14b0d6ffb788`

Tags:
- `decision-records`

Contract:
- 已索引的 Decision ID 按独立 sourcePath 选择；同名旧 ID basename 的未选择非法文件不参与身份匹配或阻断暂存。

Proves:
- 语义 sourcePath 的正文修改与索引进入 pending，未选择的旧 ID basename 不进入 pending。
