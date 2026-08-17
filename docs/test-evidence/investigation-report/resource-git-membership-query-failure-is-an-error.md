### Case INVESTIGATION-RESOURCE-MEMBERSHIP-001: Git 成员查询失败使完整资源验证失败

Entry:
- `tools/investigation-report/tests/resources.test.ts > a Git membership query failure makes full resource validation an error`
- `bun test --test-name-pattern="^a Git membership query failure makes full resource validation an error$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整资源验证不能在 Git 成员关系无法确定时把资源可见性结论降级为 warning。

Proves:
- Git 元数据不完整导致成员查询失败时，完整验证返回包含 membership、version-control 或 Git 的 error。
