### Case DECISION-DISCARD-FINAL-INDEX-001: 删除末条保留合法空索引

Tests:
- `test:39de13f9c45412aa6d11d51948fb1c32706392ecfc3ac8904e87434b80403c95`

Tags:
- `decision-records`

Contract:
- 删除末条正式记录仍留下可查询且可继续发布的合法空索引。

Proves:
- discard 后索引 entries 为空且 list 成功；随后创建并发布新候选可从该空索引继续维护。
