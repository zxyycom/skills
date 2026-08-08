### Case DECISION-FIRST-ESTABLISHMENT-001: 首次建立创建决策域与当前索引
Entry:
- `tools/decision-records/tests/first-establishment.test.ts > first establishment creates a decision domain and current index`
- `bun test --test-name-pattern="^first establishment creates a decision domain and current index$" ./tools/decision-records/tests/run.ts`
Contract:
- 空 workspace 中首次审核并建立显式候选必须创建 domain 定义和当前索引，其他合法候选可以继续等待审核。
Proves:
- 首个候选激活后产生 definitionVersion 5、schema v3 的 ID-keyed 索引；stored entry 不重复保存 ID，且 entries 与逐路径 revision 成员一致。
- 首个决策可立即查询，剩余候选被计数且不阻断严格检查。
- 第二个候选激活后两条记录都进入正式索引。
