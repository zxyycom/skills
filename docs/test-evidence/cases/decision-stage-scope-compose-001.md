### Case DECISION-STAGE-SCOPE-COMPOSE-001: index 与 domain 顺序组合索引和正文快照

Tests:
- `test:61d316dba451f4db3a103b26f69e1d08965cafd346032d8e837f970b14e34326`

Tags:
- `decision-records`

Contract:
- index 与 domain 分别暂存所选索引投影和正文，domain 保留先前 pending 索引。

Proves:
- 真实 Git 中先 index 后 domain 选择 A，domain 后 A 是工作区正文，而 index 步骤的 pending 索引字节及未选 B 正文均保持。
