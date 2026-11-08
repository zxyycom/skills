### Case DECISION-STAGE-SEMANTIC-SOURCE-PATH-002: stage ignores an invalid former ID basename after an ID keeps a semantic sourcePath

Tests:
- `test:f46f104e5ce84c3294a22b131385495083983e819190134032dfc126c6a01adb`

Tags:
- `decision-records`

Contract:
- 已索引 ID 按 sourcePath 选择，未选择的同 name basename 非法正文不阻断。

Proves:
- 同步后 sourcePath 是 semantic-current.md，未选 record.md 为非法正文；真实 all stage 仍成功暂存所选内容，未选文件不进入 pending。
