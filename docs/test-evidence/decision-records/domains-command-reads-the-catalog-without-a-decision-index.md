### Case DECISION-DOMAIN-CATALOG-QUERY-001: Domains 命令无需决策索引即可读取目录
Entry:
- `tools/decision-records/tests/decision-domain-catalog.test.ts > domains command reads the catalog without a decision index`
- `bun test --test-name-pattern="^domains command reads the catalog without a decision index$" ./tools/decision-records/tests/run.ts`
Contract:
- Domains 查询直接读取权威领域目录表，不依赖派生决策索引。
Proves:
- 删除 decision-index.json 后命令仍退出 0，并列出全部定义领域。
