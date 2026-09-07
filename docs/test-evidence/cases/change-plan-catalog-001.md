### Case CHANGE-PLAN-CATALOG-001: Catalog 仅列出直接 Change 并排除 tombstone

Tests:
- `test:0dcdd83ff38c08024d6d5b36c16ea466037a0b908ec521354e66a1c2481b40a5`

Tags:
- `change-plan`

Contract:
- Catalog 发现 Change root 的直接成员，包括需要修复的无效目录；`archive` 没有保留语义；`.change-plan-tombstones` 永不成为 member 或检查输入。

Proves:
- list 返回有效的 `archive`、有效与无效的其他直接 Change 名称，不返回 tombstone。
- collection check 的数量只计算三个直接 Change，并将无效 member 作为门禁失败。
