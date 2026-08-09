### Case DECISION-ACTIVATE-RELATION-CLEAR-001: Activate 显式清空候选来源关系
Entry:
- `tools/decision-records/tests/evolution.test.ts > activate clear-relations explicitly replaces candidate relations with an empty set`
- `bun test --test-name-pattern="^activate clear-relations explicitly replaces candidate relations with an empty set$" ./tools/decision-records/tests/run.ts`
Contract:
- `--clear-relations` 是把新候选完整关系替换为空集合的显式意图，不等同于省略覆盖，也不处理已从最终集合移除的来源目标。
Proves:
- 带预写关系的候选通过 activate 建立后拥有空关系集合。
- 原来源关系指向的活动记录保持 active。
