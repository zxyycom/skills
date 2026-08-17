### Case INVESTIGATION-RESOURCE-PROJECTION-001: Owner 报告锚定资源并允许跨主题共享

Entry:
- `tools/investigation-report/tests/resources.test.ts > owner reports anchor resource prefixes before other topics share them`
- `bun test --test-name-pattern="^owner reports anchor resource prefixes before other topics share them$" ./tools/investigation-report/tests/run.ts`

Contract:
- 每个资源 ID 必须由其 owner 主题路径前缀锚定；其他主题可引用已经由 owner 报告声明的资源。
- 索引只在主题 state 中保存报告级资源引用，不再保存集合级资源摘要。

Proves:
- owner 主题按报告顺序投影其文本和二进制资源引用，另一主题可以复用同一 owner 资源。
- 索引使用 definition version 5、空 metadata，并为两份主题保存按资源 ID 排序的报告级引用。
