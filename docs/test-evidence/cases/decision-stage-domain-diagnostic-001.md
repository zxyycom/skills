### Case DECISION-STAGE-DOMAIN-DIAGNOSTIC-001: Stage 将重复选择来源标识报告为领域错误

Tests:
- `test:776d7b89f2826481e5bcb400aed93ec8ac7fe082da83fb60e38feefa53af7b95`

Tags:
- `decision-records`

Contract:
- Stage 遇到同一 Decision ID 同时出现在 current 与 archive 来源时，这是领域来源冲突而非文件系统故障；诊断必须保留稳定领域 code 与受控 detail，不能伪报 filesystem unknown。

Proves:
- CLI 以失败退出且 stdout 为空，输出 `decision-records.stage-snapshot-invalid` 与重复来源说明。
- 输出不包含 `causeCategory: unknown`。
