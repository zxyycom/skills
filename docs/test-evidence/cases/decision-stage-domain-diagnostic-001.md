### Case DECISION-STAGE-DOMAIN-DIAGNOSTIC-001: Stage 将重复选择来源标识报告为领域错误

Tests:
- `test:e5299822fc28d9e533cf29d0a1a7d307b0aa95c33ed7e2957e3d88208dd0aa34`

Tags:
- `decision-records`

Contract:
- Stage 遇到同一 Decision ID 同时出现在 current 与 archive 来源时，这是领域来源冲突而非文件系统故障；诊断必须保留稳定领域 code 与受控 detail，不能伪报 filesystem unknown。

Proves:
- CLI 以失败退出且 stdout 为空，输出 `decision-records.stage-snapshot-invalid` 与重复来源说明。
- 输出不包含 `causeCategory: unknown`。
