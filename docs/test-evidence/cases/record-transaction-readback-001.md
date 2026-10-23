### Case RECORD-TRANSACTION-READBACK-001: 共同事务验收目标表示后才成功

Tests:
- `test:527db58cbac79b03ef29f1f292ddfdd422283b7c72b6c6c175730ca6b8598c3b`
- `test:8aef2dcb06c1f47ef6936f74f193b3fdc16f9b16e2e5fe5c097000d53e1634f9`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 成功须实际目标 bytes、identity、mode 和索引提交验收，writer 返回不替代证明。

Proves:
- 两域原生入口调用相同共同契约，实际写两份来源与索引并保持0640权限，核对 committed 和 verification。
