### Case INVESTIGATION-RESOURCE-PROJECTION-001: report-owned resources validate exact links and permit shared references

Entry:
- `tools/investigation-report/tests/resources.test.ts > report-owned resources validate exact links and permit shared references`
- `bun test --test-name-pattern="^report-owned resources validate exact links and permit shared references$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源由唯一 owner report 维护，其他报告可以通过精确链接共享引用。

Proves:
- owner 与 consumer 共同引用同一资源时完整验证成功。
