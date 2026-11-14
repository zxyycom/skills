### Case RESOURCE-BROKEN-PIPE-001: 输出断管后的索引状态

Tests:
- `test:35bf92ebca4d312c69af95fd5de5a10436be4ea107cd176a813413010f8bfaae`

Tags:
- `resource-records`

Contract:
- 同步提交后输出失败须非 panic 地报告提交状态及恢复方式。

Proves:
- 关闭真实 stdout 管道并检查错误状态、stderr 中的索引状态及 check 或 sync-index 建议，再以 check 核验索引；覆盖首次创建与替换，但首个失败会阻断后续步骤。
