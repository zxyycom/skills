### Case CHANGE-PLAN-CATALOG-001: Catalog 仅列出直接 Change 并排除 tombstone
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog lists direct active members and excludes private tombstones`
- `bun test --test-name-pattern="^catalog lists direct active members and excludes private tombstones$" ./tools/change-plan/tests/run.ts`
Contract:
- Catalog 发现 Change root 的直接成员，包括需要修复的无效目录；`archive` 没有保留语义；`.change-plan-tombstones` 永不成为 member 或检查输入。
Proves:
- list 返回有效的 `archive`、有效与无效的其他直接 Change 名称，不返回 tombstone。
- collection check 的数量只计算三个直接 Change，并将无效 member 作为门禁失败。
