### Case DECISION-ACTIVATE-RELATION-CLEAR-001: Evolve 显式清空候选来源关系

Tests:
- `test:ba2f633bf71c00539290123efeb35cb6bcac3449f64b9b428e37714974a9a203`

Tags:
- `decision-records`

Contract:
- evolve 的 `--clear-relations` 是把候选完整关系替换为空集合的显式意图，不等同于省略覆盖；committed relationReview 必须展示空最终集合及被移除的旧边。

Proves:
- 提交 review 标记 establish、显示 `after relations: []` 和被移除的无摘要边。
- 建立后的候选拥有空关系集合，原来源关系指向的活动记录保持 active。
