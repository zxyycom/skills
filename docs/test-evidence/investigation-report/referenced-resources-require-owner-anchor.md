### Case INVESTIGATION-RESOURCE-OWNER-001: 被引用资源需要 Owner 主题与 Owner 报告引用

Entry:
- `tools/investigation-report/tests/resources.test.ts > referenced resources require an owner topic and an owner report reference`
- `bun test --test-name-pattern="^referenced resources require an owner topic and an owner report reference$" ./tools/investigation-report/tests/run.ts`

Contract:
- 消费者主题只能共享存在的 owner 主题已在自身报告中引用的资源；缺失 owner 或 owner 未声明资源时，资源引用无效。

Proves:
- 缺失 owner 与 owner 未引用资源分别产生包含相应资源 ID 的阻断诊断。
