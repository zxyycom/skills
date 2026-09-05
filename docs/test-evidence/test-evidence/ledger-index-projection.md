### Case TEST-EVIDENCE-LEDGER-INDEX-PROJECTION-001: 派生索引保存最小可检索 State 投影
Entry:
- `tools/test-evidence/tests/ledger-index.test.ts > ledger indexes project definition metadata summaries revisions and query keys`
- `bun test --test-name-pattern="^ledger indexes project definition metadata summaries revisions and query keys$" ./tools/test-evidence/tests/run.ts`
Contract:
- `definitionVersion: 5` 索引必须保存 Case 摘要、Test/Tag/search state 与来源 revision，不持久化 Test→Cases 反向关系。
Proves:
- 写入独立 ledger indexPath 的索引满足通用状态索引 `schemaVersion: 4`、领域 `definitionVersion: 5`、实体 metadata 一致性和最小字段边界。
