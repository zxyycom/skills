### Case INVESTIGATION-DISCARD-CANDIDATE-001: discard-candidate protects shared and recorded resources

Entry:

- `tools/investigation-report/tests/publish.test.ts > discard-candidate protects shared and recorded authoring resources without changing formal reports`
- `bun test --test-name-pattern="^discard-candidate protects shared and recorded authoring resources without changing formal reports$" ./tools/investigation-report/tests/run.ts`

Contract:

- `discard-candidate` 只删除显式 candidate 及确认的 owner 资源；共享引用和 Git HEAD 记录先阻断，正式报告与索引不属于该事务。

Proves:

- 其他 candidate 引用 owner resource 时拒绝删除。
- Git 已记录 candidate 需要独立确认；确认后 candidate 与 owner resource 删除，正式报告字节不变。
