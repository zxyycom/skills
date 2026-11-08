### Case DECISION-STAGE-BOOTSTRAP-001: Stage 构建第一份决策集合投影

Tests:
- `test:aad4af5de2fdc7b37fea5e911cd2fe4302a1639b9723ca69b27857da831b6ed4`

Tags:
- `decision-records`

Contract:
- 没有 HEAD 时 all scope 只暂存所选已发布对象与其索引投影。

Proves:
- 真实 unborn Git 中工作区有两个已发布对象，选择 A 后 pending 包含 A 正文及索引条目，不含 B 正文及条目。
