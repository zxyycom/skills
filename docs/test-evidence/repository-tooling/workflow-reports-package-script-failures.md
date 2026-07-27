### Case CHECK-WORKFLOW-PACKAGE-FAILURE-001: 打包脚本失败决定最终工作流失败
Entry:
- `scripts/check.test.ts > workflow reports package script failures`
- `bun test --test-name-pattern="^workflow reports package script failures$" ./scripts/check.test.ts`
Contract:
- 即使预检查全部通过，打包脚本失败也必须令完整工作流失败。
Proves:
- 工作流运行打包并返回 failed，且不会把打包失败误报为跳过。
