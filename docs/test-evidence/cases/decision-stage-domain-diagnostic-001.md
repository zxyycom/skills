### Case DECISION-STAGE-DOMAIN-DIAGNOSTIC-001: Stage 将重复选择来源标识报告为领域错误

Tests:
- `test:776d7b89f2826481e5bcb400aed93ec8ac7fe082da83fb60e38feefa53af7b95`

Tags:
- `decision-records`

Contract:
- 来源发现遇到同一 Decision ID 对应多个路径时，这是领域来源冲突而非文件系统故障；Stage failure mapper 保留稳定领域 code 与受控 detail，不伪报 filesystem unknown。

Proves:
- 真实来源发现与 resolver 对两条同 ID 路径拒绝，stage failure mapper 返回 stage-snapshot-invalid 与重复来源 detail。
- 领域诊断不包含 causeCategory: unknown；该入口不启动 CLI。
