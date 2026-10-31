### Case RECORD-TRANSACTION-READBACK-001: 共同事务验收目标表示后才成功

Tests:
- `test:3d4000e707e18e874ad7b271de5a9a637f4d99179b2761ee976c9dd315f1c111`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 成功须实际目标 bytes、identity、mode 和索引提交验收，writer 返回不替代证明。

Proves:
- 单份共同原生入口实际写两份来源与索引并保持 0640 权限，核对 committed、verification 及完整目标表示；两域适配另由各域入口验证。
