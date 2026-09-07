### Case DECISION-ACTIVATE-RELATION-CLEAR-001: Activate 显式清空候选来源关系

Tests:
- `test:c466d354f4a35a872e4cf30a68f671fd5a6493905fe3c265e5707b2e3ab2b51f`

Tags:
- `decision-records`

Contract:
- `--clear-relations` 是把新候选完整关系替换为空集合的显式意图，不等同于省略覆盖，也不处理已从最终集合移除的来源目标。

Proves:
- 带预写关系的候选通过 activate 建立后拥有空关系集合。
- 原来源关系指向的活动记录保持 active。
