### Case INVESTIGATION-STAGE-DOMAIN-BUSY-001: 领域 pending 忙错误映射为无变化冲突

Tests:
- `test:70c610c954f32b51195d93ededc53b439c24442a26f86dfc1adfbc5674a61eb0`

Tags:
- `investigation-report`

Contract:
- domain scope 将 pending-conflict / busy 的版本控制错误映射为无变化冲突结果与可辨识诊断。

Proves:
- 向领域失败映射传入 busy `VersionControlError`，返回 error、pending-conflict、changed=false、domain scope 与 no-change outcome，保留诊断 code、busy category 和消息。
