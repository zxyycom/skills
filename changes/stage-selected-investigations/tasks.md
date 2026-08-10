# Tasks

任务按“公共前置 → 主题 id 接入 → 行为分发 → 验证”推进；公共索引按条目暂存未完成前不得实施调查接入。

## Readiness

- [x] 0.1 确认 `stage-selected-index-entries` 已完成公共 API、长期决策对齐和全部验证。
- [x] 0.2 确认调查主题路径本身就是稳定索引 id，本 change 不建立第二套选择身份，也不构造索引基线、state 变化或目标 revision。
- [x] 0.3 确认调查 Markdown 不由该索引暂存入口处理，同一索引已有待提交变化时直接拒绝；`Open Questions` 为“无”。
- [x] 0.4 确认随附资源 ID、哈希与 `sourceRevision.metadata` 是集合级契约；资源变化时按主题暂存必须拒绝并改用普通文件级暂存完整索引。

## Implementation

- [x] 1.1 建立调查选择性索引暂存长期决策并保持 `unaligned`。
- [x] 1.2 实现调查主题 id 的路径规范、非空和去重校验，覆盖新增、删除和显式重命名输入。
- [x] 1.3 实现 `stage-index <topic-id...>`，调用配置完成的 `StateIndexRuntime.stageSelectedEntries(selectedIds)` 并输出稳定文本/JSON 结果。
- [x] 1.4 更新 investigation-report 的行为入口、固定契约、人类说明和独立版本，明确领域文件需另行暂存。
- [x] 1.5 同步公共声明、自包含 CLI 和 source map；验证共享源码正确内联。
- [x] 1.6 完成事实核对后把长期决策标记为 `aligned`。

## Verification

- [x] 2.1 以领域测试覆盖并行 A/B、修改、新增、删除、重命名和首次索引，并复用公共测试对合法空目标的证明；调查集合继续由既有契约拒绝空集合。
- [x] 2.2 以领域测试覆盖重复或非法 id、两份索引都不存在的 id、无仓库和同索引既有 pending；复用公共测试覆盖 revision 冲突与写入恢复，并回归 check/sync/list。
- [x] 2.3 确认命令不修改 filesystem、不读取或暂存调查 Markdown 与随附资源，其他待提交路径保持不变；资源 metadata 变化时在写入前拒绝。
- [x] 2.4 为新增或修改测试入口维护独立测试证据 case，并同步索引。
- [x] 2.5 运行 `bun run test:investigation-report-check`、生成漂移、类型检查、严格目录检查与 `bun run check`，审阅最终 diff。
