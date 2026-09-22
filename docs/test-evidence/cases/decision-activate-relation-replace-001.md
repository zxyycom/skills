### Case DECISION-ACTIVATE-RELATION-REPLACE-001: Evolve 关系覆盖完整替换候选来源关系

Tests:
- `test:8a4742837c247e1306845a709897b0288d5960e22da494ad629bc5d6114e3c26`

Tags:
- `decision-records`

Contract:
- evolve 的重复 `--relation` 表达候选最终关系的完整覆盖，不能与候选来源关系追加或合并。

Proves:
- 建立后的候选只保存 CLI 提供的替代关系，不再包含源码中原有的修订关系。
- 覆盖新增的活动目标被归档，已从最终集合移除的原来源目标保持 active。
