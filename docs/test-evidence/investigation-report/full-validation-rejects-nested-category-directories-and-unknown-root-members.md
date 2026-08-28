### Case INVESTIGATION-COLLECTION-LAYOUT-001: full validation rejects nested category directories and unknown root members

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > full validation rejects nested category directories and unknown root members`
- `bun test --test-name-pattern="^full validation rejects nested category directories and unknown root members$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整验证拒绝平铺报告集合中的嵌套旧目录和未知根成员。

Proves:
- 根目录出现嵌套旧目录时返回 not-allowed 诊断。
