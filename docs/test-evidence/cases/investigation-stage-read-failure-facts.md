### Case INVESTIGATION-STAGE-READ-FAILURE-FACTS-001: 写前读取失败保留净化事实与恢复动作

Tests:
- `test:34ccfba0b5f409f1fa425733856e42291608080009e47f0a58568c99aca9879f`

Tags:
- `investigation-report`

Contract:
- 写前来源读取失败保持source-drift并保留可靠底层原因与恢复动作，不写pending。

Proves:
- 第二phase EACCES输出access-denied、操作、相对目标和恢复实际read/write所需访问权限的动作，无原始私密路径、凭据或伪造mutation，index未变。
