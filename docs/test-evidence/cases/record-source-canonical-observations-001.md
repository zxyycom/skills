### Case RECORD-SOURCE-CANONICAL-OBSERVATIONS-001: 每次安全读取独立确认 canonical 命名空间

Tests:
- `test:7a5b025254e48467033c79b3ab3b14e48b5ec005e2b5e8f941113fec1158eecd`

Tags:
- `record-operations`

Contract:
- 每次来源读取独立确认 canonical 根，并在读取前后核对目标的精确 canonical 路径；目标观察同时证明其路径前缀，不跨读取借用观察事实。

Proves:
- 根直属与 archive 来源各在名为 prepare/fresh 的两轮循环中独立读取，每份每轮恰有初始根及目标前后共三次 realpath、一次 open，并返回完整相同正文；这是直接读取契约，不是实际 sync/事务 fresh 或 1W 性能证明。
- 别名根与越界目标同时传入时，读取先报告 canonical 根错误；公开 recordCollectionIdentity 也独立拒绝该别名根。
