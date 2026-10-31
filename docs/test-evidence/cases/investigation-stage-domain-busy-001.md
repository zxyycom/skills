### Case INVESTIGATION-STAGE-DOMAIN-BUSY-001: 领域 pending 忙错误映射为无变化冲突

Tests:
- `test:a954f2929237bb67206492702b6289d560783803a2b937c4f940d6ff04d725e9`

Tags:
- `investigation-report`

Contract:
- domain scope 将 pending-conflict / busy 的版本控制错误映射为无变化冲突结果与可辨识诊断。

Proves:
- 向领域失败映射传入 busy `VersionControlError`，返回 error、pending-conflict、changed=false、domain scope 与 no-change outcome，保留诊断 code、busy category 和消息。
