### Case DECISION-TYPE-PATH-001: 稳定 ID、标签与来源路径不变量

Tests:
- `test:23680526b667755ee89f15444ef88deb59392a0976dc9175950e03be0ebfd7d6`

Tags:
- `decision-records`

Contract:
- 决策类型以 extensionless Decision ID 承担稳定身份；`sourcePath` 独立承载 Markdown 位置并与生命周期位置保持一致。

Proves:
- 类型和路径辅助函数拒绝不符合稳定 ID 或物理布局的值，并保留可序列化的标签和来源路径。
