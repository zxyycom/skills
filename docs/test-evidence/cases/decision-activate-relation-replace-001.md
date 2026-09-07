### Case DECISION-ACTIVATE-RELATION-REPLACE-001: Activate 关系覆盖完整替换候选来源关系

Tests:
- `test:18ede71531fef0735eb36791c309dec52794c67719b6ead57b10b22d35a521d8`

Tags:
- `decision-records`

Contract:
- Activate 的重复 `--relation` 表达候选最终关系的完整覆盖，不能与候选来源关系追加或合并。

Proves:
- 建立后的候选只保存 CLI 提供的替代关系，不再包含源码中原有的修订关系。
- 覆盖新增的活动目标被归档，已从最终集合移除的原来源目标保持 active。
