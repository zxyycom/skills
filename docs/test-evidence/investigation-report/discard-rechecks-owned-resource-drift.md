### Case INVESTIGATION-DISCARD-RESOURCE-DRIFT-001: discard rechecks ignored owner resource drift before publishing

Entry:
- `tools/investigation-report/tests/discard.test.ts > discard rechecks ignored owner resource drift before publishing`
- `bun test --test-name-pattern="^discard rechecks ignored owner resource drift before publishing$" ./tools/investigation-report/tests/run.ts`

Contract:
- discard 在发布前必须重新比较 owner 资源成员，防止预演后的资源变化进入递归删除。

Proves:
- 预演后新增 ignored owner 资源使发布失败，报告和原资源保持存在。
