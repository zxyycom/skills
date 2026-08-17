### Case INVESTIGATION-STAGE-DEFINITION-UPGRADE-001: 暂存不混合旧 v4 Revision 与 v5 工作区索引

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index does not combine a legacy v4 revision with a v5 workspace index`
- `bun test --test-name-pattern="^stage-index does not combine a legacy v4 revision with a v5 workspace index$" ./tools/investigation-report/tests/run.ts`

Contract:
- 选择性索引暂存不得把 revision 中的 legacy v4 索引与工作区 v5 索引合并；定义升级必须作为完整索引变更处理。

Proves:
- 对 v4 基线选择主题 A 时暂存返回 error 且不创建 pending。
- 手动加入 v5 工作区索引后，pending 仅包含派生索引，表明升级没有被逐主题 overlay。
