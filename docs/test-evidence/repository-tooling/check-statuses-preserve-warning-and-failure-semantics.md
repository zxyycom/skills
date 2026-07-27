### Case CHECK-STATUS-OUTPUT-001: 检查状态保留警告与失败语义
Entry:
- `scripts/check.test.ts > check statuses preserve warning and failure semantics`
- `bun test --test-name-pattern="^check statuses preserve warning and failure semantics$" ./scripts/check.test.ts`
Contract:
- 成功、可恢复失败和阻断失败必须解析为各自的稳定状态。
Proves:
- 警告模式下的普通失败保持可恢复，strict 或显式 blocking 任务仍产生失败状态。
