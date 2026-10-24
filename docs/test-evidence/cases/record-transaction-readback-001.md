### Case RECORD-TRANSACTION-READBACK-001: 共同事务验收目标表示后才成功

Tests:
- `test:7171ec9e595a4baa86185fdba0765e9de419b75643975b073918557ab6be45c9`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 成功须实际目标 bytes、identity、mode 和索引提交验收，writer 返回不替代证明。

Proves:
- 单份共同原生入口实际写两份来源与索引并保持 0640 权限，核对 committed、verification 及完整目标表示；两域适配另由各域入口验证。
