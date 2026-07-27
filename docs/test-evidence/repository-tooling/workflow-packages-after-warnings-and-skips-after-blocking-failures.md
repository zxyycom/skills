### Case CHECK-WORKFLOW-PACKAGING-001: 打包只在无阻断失败时运行
Entry:
- `scripts/check.test.ts > workflow packages after warnings and skips after blocking failures`
- `bun test --test-name-pattern="^workflow packages after warnings and skips after blocking failures$" ./scripts/check.test.ts`
Contract:
- 完整工作流可在警告后打包，但任何阻断失败都必须跳过打包。
Proves:
- 警告路径调用打包，阻断失败路径不调用打包。
