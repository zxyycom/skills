### Case DECISION-STAGE-SELECTED-MEMBER-TYPE-001: Stage 拒绝指向决策根外的选择 symlink

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects a selected symlink source outside the decision root`
- `bun test --test-name-pattern="^stage rejects a selected symlink source outside the decision root$" ./tools/decision-records/tests/run.ts`

Contract:
- revision 模式下，选择的 ID 必须对应决策根内的普通 Markdown 文件；symlink 等非普通来源不得读取其外部字节或写入 pending。

Proves:
- 将已选择记录替换为指向根外合法 Markdown 的 symlink 后，stage 失败且暂存区为空；平台不支持 symlink 时按测试框架标记跳过。
