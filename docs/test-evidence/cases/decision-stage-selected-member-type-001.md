### Case DECISION-STAGE-SELECTED-MEMBER-TYPE-001: Stage 拒绝指向决策根外的选择 symlink 且不写入 pending

Tests:
- `test:946f14db4e885cd73f5d348e563d3ab4f6254e8c63319b8d10a534d6462b2a17`

Tags:
- `decision-records`

Contract:
- stage 选择的 ID 必须对应普通非符号链接 Markdown 来源；不安全来源不得写入 pending。

Proves:
- 真实 stage 拒绝所选外部 symlink，返回 regular non-symlink 诊断；pending tree、外部字节及 symlink 保持不变，不支持 symlink 的平台跳过。
