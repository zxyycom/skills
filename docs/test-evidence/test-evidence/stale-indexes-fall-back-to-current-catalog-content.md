### Case TEST-EVIDENCE-STALE-INDEX-001: 过期索引回退到当前 catalog
Entry:
- `tools/test-evidence/tests/catalog.test.ts > stale indexes fall back to current catalog content`
- `bun test --test-name-pattern="^stale indexes fall back to current catalog content$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 派生索引落后于 catalog 时，查询与展示必须使用当前正文。
Proves:
- Case 仍可读取，同时返回非阻断 `state-index.index-stale` 诊断。
