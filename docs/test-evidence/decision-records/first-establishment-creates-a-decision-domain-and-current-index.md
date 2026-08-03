### Case DECISION-FIRST-ESTABLISHMENT-001: 首次建立创建决策域与当前索引
Entry:
- `tools/decision-records/tests/first-establishment.test.ts > first establishment creates a decision domain and current index`
- `bun test --test-name-pattern="^first establishment creates a decision domain and current index$" ./tools/decision-records/tests/run.ts`
Contract:
- 空 workspace 中首次建立决策必须创建 domain 定义和当前索引。
Proves:
- 新决策可立即被域目录和当前 definitionVersion 4 索引查询。
