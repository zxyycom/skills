### Case DECISION-STAGE-SELECTED-MEMBER-TYPE-001: Stage 拒绝指向决策根外的选择 symlink 且不写入 pending

Tests:
- `test:9c285809cd386615a001a1671b9138fae4838e75bf8bfb9891dbf328e78bdd61`

Tags:
- `decision-records`

Contract:
- stage 选择的 ID 必须对应决策根内的普通 Markdown 文件；symlink 等非普通来源不得读取其外部字节或写入 pending。

Proves:
- 真实文件来源复核拒绝指向决策根外的 symlink，返回 regular non-symlink 错误，外部字节与 symlink 表示保持不变；不观察 Git index，平台不支持 symlink 时跳过。
