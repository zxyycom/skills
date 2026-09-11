### Case DECISION-STAGE-SELECTED-MEMBER-TYPE-001: Stage 拒绝指向决策根外的选择 symlink 且不写入 pending

Tests:
- `test:9c285809cd386615a001a1671b9138fae4838e75bf8bfb9891dbf328e78bdd61`

Tags:
- `decision-records`

Contract:
- stage 选择的 ID 必须对应决策根内的普通 Markdown 文件；symlink 等非普通来源不得读取其外部字节或写入 pending。

Proves:
- 将已选择记录替换为指向根外合法 Markdown 的 symlink 后，stage 给出精确 non-symlink 诊断，外部文件字节与 Git pending index 保持不变；平台不支持 symlink 时按测试框架标记跳过。
