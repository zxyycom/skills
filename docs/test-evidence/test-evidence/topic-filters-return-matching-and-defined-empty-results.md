### Case TEST-EVIDENCE-TOPIC-FILTER-001: Topic 过滤返回匹配与已定义空结果
Entry:
- `tools/test-evidence/tests/run.ts > topic filters return matching and defined-empty results with topic definitions`
- `bun test --test-name-pattern="^topic filters return matching and defined-empty results with topic definitions$" ./tools/test-evidence/tests/run.ts`
Contract:
- 精确 topic 查询必须区分有匹配 case、已定义但为空的 topic，并在查询与 show 中返回 topic 定义。
Proves:
- 有内容的 topic 只返回自身 case，预留空 topic 返回零项，show 返回 case 所属 topic 的描述。
