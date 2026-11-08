### Case DECISION-STAGE-SELECTED-MEMBER-TYPE-001: Stage 拒绝指向决策根外的选择 symlink 且不写入 pending

Tests:
- `test:c1ed0c7ba2efd8b1517c3d2c6ac413d24d85a540b2a0880560d62923f51481c4`

Tags:
- `decision-records`

Contract:
- stage 所选来源必须是安全的非 symlink 文件。

Proves:
- Unix 上所选新位置是指向外部文件的 symlink 时，all/domain 均失败；pending 条目、外部文件字节及 symlink 保持。
