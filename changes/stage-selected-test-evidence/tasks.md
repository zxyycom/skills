# Tasks

任务按“公共前置 → case id 接入 → 行为分发 → 验证”推进；公共索引按条目暂存未完成前不得实施测试证据接入。

## Readiness

- [x] 0.1 确认 `stage-selected-index-entries` 已完成公共 API、长期决策对齐和全部验证。
- [x] 0.2 确认 case id 本身就是稳定索引 id，本 change 不建立第二套选择身份，也不构造索引基线、state 变化、目标 metadata 或 revision。
- [x] 0.3 确认 topic 表、case Markdown 和代码不由该索引暂存入口处理，同一索引已有待提交变化时直接拒绝；`Open Questions` 为“无”。

## Implementation

- [x] 1.1 建立测试证据选择性索引暂存长期决策并保持 `unaligned`。
- [x] 1.2 实现 case id 的格式、非空和去重校验，覆盖新增、删除和显式重命名输入；topic 归属继续由现有 definition 完整校验。
- [x] 1.3 实现 `stage-index <case-id...>`，调用配置完成的 `StateIndexRuntime.stageSelectedEntries(selectedIds)` 并输出稳定文本/JSON 结果。
- [x] 1.4 更新 test-evidence-review 的行为入口、固定契约、人类说明和独立版本，明确领域文件与代码需另行暂存。
- [x] 1.5 同步 JSON 结果 Schema、公共声明、自包含 CLI 和 source map。
- [ ] 1.6 完成事实核对后把长期决策标记为 `aligned`。

## Verification

- [x] 2.1 覆盖并行 A/B、修改、新增、删除、重命名、首次索引和合法空结果，证明命令只向索引传递选中 id。
- [x] 2.2 覆盖未知 topic、重复或非法 id、两份索引都不存在的 id、无仓库、同索引既有 pending、revision 冲突和写入恢复，并回归 topics/check/sync/list/show。
- [x] 2.3 确认命令不修改 filesystem、不读取或暂存 topic 表、case Markdown 或代码，其他待提交路径保持不变。
- [x] 2.4 为新增或修改测试入口维护独立测试证据 case，并同步索引。
- [ ] 2.5 运行 `bun run test:test-evidence-cli`、生成漂移、类型检查、严格目录检查与 `bun run check`，审阅最终 diff。
