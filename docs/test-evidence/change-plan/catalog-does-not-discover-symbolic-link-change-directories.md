### Case CHANGE-PLAN-CATALOG-SYMLINK-001: Catalog 不发现符号链接 change
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog does not discover symbolic-link change directories`
- `bun test --test-name-pattern="^catalog does not discover symbolic-link change directories$" ./tools/change-plan/tests/run.ts`
Contract:
- Change catalog 只发现受管理根目录中的真实目录。
Proves:
- 指向其他位置的符号链接目录不会被登记为 change。
