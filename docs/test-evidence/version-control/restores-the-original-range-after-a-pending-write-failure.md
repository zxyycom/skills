### Case VERSION-CONTROL-PENDING-WRITE-FAILURE-001: pending 写入失败后保留原范围
Entry:
- `tools/shared/tests/version-control.test.ts > restores the original range after a pending write failure`
- `bun test --test-name-pattern="^restores the original range after a pending write failure$" ./tools/shared/tests/version-control.test.ts`
Contract:
- pending 范围写入失败不能留下部分目标；确认原范围完整后以稳定项目错误报告失败。
Proves:
- 写入不可用时返回 `pending-replacement-failed`，错误不泄漏底层实现值且范围内容与写入前一致。
