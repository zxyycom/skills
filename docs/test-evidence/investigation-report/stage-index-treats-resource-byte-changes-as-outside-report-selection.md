### Case INVESTIGATION-STAGE-RESOURCE-BYTES-001: stage-index treats resource byte changes as outside report selection

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index treats resource byte changes as outside report selection`
- `bun test --test-name-pattern="^stage-index treats resource byte changes as outside report selection$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源字节变化不扩大报告 entry 的选择范围。

Proves:
- 资源字节场景保持报告 ID 选择边界。
