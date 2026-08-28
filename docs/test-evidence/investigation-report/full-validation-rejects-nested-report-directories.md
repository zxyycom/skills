### Case INVESTIGATION-COLLECTION-LAYOUT-001: full validation rejects nested report directories

Entry:

- `tools/investigation-report/tests/parsing-directory.test.ts > full validation rejects nested report directories`
- `bun test --test-name-pattern="^full validation rejects nested report directories$" ./tools/investigation-report/tests/run.ts`

Contract:

- 平铺 Investigation Report 集合不允许嵌套报告目录。

Proves:

- 根目录出现嵌套旧目录时，完整验证返回 not-allowed 诊断。
