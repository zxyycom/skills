### Case DECISION-STAGE-SELECTED-MEMBER-TYPE-001: Stage 拒绝指向决策根外的选择 symlink 且不写入 pending

Tests:
- `test:db9306e39de682479b23d96944b57a2dcfb79b53c2e9a39ee1c580029ba33172`

Tags:
- `decision-records`

Contract:
- stage 选择的 ID 必须对应决策根内的普通 Markdown 文件；symlink 等非普通来源不得读取其外部字节或写入 pending。

Proves:
- 将已选择记录替换为指向根外合法 Markdown 的 symlink 后，stage 给出精确 non-symlink 诊断，外部文件字节与 Git pending index 保持不变；平台不支持 symlink 时按测试框架标记跳过。
