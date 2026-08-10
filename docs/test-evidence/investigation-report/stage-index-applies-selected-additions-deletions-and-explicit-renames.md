### Case INVESTIGATION-STAGE-OVERLAY-001: 选择性暂存组合新增、删除和显式重命名
Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index applies selected additions deletions and explicit renames`
- `bun test --test-name-pattern="^stage-index applies selected additions deletions and explicit renames$" ./tools/investigation-report/tests/run.ts`
Contract:
- 主题新增、删除和路径重命名必须由新旧稳定 ID 的选择表达，未选择主题的工作区修改继续使用 revision 基线。
Proves:
- 一个目标索引同时删除两个旧 ID、加入重命名后的新 ID 和新增 ID，并保留未选择 A 的基线条目；文本结果稳定报告排序后的选择与变化状态。
