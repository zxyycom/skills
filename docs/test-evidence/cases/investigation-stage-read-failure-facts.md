### Case INVESTIGATION-STAGE-READ-FAILURE-FACTS-001: 写前读取失败保留净化事实与恢复动作

Tests:
- `test:5522bbc0b481f43dd8180ce6282ab9f5cd1fb880505ed5bd515c641394372ac4`

Tags:
- `investigation-report`

Contract:
- 写前来源读取失败保持source-drift并保留可靠底层原因与恢复动作，不写pending。

Proves:
- 第二phase EACCES输出access-denied、操作、相对目标和恢复实际read/write所需访问权限的动作，无原始私密路径、凭据或伪造mutation，index未变。
