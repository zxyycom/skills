### Case CHECK-RESULT-FORMAT-001: 单项报告保持成功简洁且失败完整
Entry:
- `scripts/check.test.ts > check report formatting keeps success concise and failures complete`
- `bun test --test-name-pattern="^check report formatting keeps success concise and failures complete$" ./scripts/check.test.ts`
Contract:
- 单项成功默认只显示摘要，失败始终显示捕获日志，verbose 显式显示成功日志，跳过项必须显示原因。
Proves:
- passed、failed 和 skipped 报告生成预期摘要。
- 默认、verbose 与失败场景按契约保留或展开日志详情。
