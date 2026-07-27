### Case CHECK-RESULT-FORMAT-001: 检查结果保留诊断、状态与耗时
Entry:
- `scripts/check.test.ts > check result formatting preserves diagnostics and timing`
- `bun test --test-name-pattern="^check result formatting preserves diagnostics and timing$" ./scripts/check.test.ts`
Contract:
- 检查摘要必须稳定呈现状态和耗时，并按结果类型保留必要诊断输出。
Proves:
- passed、warning 和 failed 结果生成预期摘要与输出通道，整体耗时使用相同格式。
