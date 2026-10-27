### Case GATE-SELECTED-RECEIPT-ISOLATION-001: selected 成败不冒发完整证明且不套用 quick 预算

Tests:
- `test:f02ed52fa21ecca5ae307b641b42cb26bf214f8a3049d2639bbe849db5efe4a5`

Tags:
- `repository-tooling`

Contract:
- selected 不读取或发布全仓 receipt；成功与失败均保留已有完整证明；selected 性能仅报告，不使用 quick 硬预算。

Proves:
- 注入 60000 毫秒墙钟时 selected 成功仍退出 0，目标 Check 原生失败则退出 1 并报告 Gate 失败，不报告预算失败。
- 两种终态均不调用输入准备或发布器，原有 receipt 字节保持不变。
