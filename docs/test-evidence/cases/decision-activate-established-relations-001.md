### Case DECISION-ACTIVATE-ESTABLISHED-RELATIONS-001: Publish 拒绝已建立记录与被移除的覆盖选项

Tests:
- `test:32a1d3f55ee5d19896ea9f4bf5ee8e601015a0e4f0ccb2286d2b054438859c66`

Tags:
- `decision-records`

Contract:
- `publish` 只建立决策候选；已建立记录返回领域失败并指向 `reactivate` 或 `evolve`。被取代的 activate 关系覆盖选项只得到普通未知选项结果。

Proves:
- 对已建立记录调用 publish 返回领域失败诊断，Markdown 与 decision-index.json 逐字节不变。
- `activate` 是未知命令；publish 上的 `--relation`、`--relation-summary` 与 `--clear-relations` 均退出 2 并报告 unknown option。
