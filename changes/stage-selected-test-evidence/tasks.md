# Tasks

任务按“公共前置 → 测试证据 adapter 与 CLI → 行为分发 → 验证”推进；公共索引物化未完成前不得实施测试证据 stage。

## Readiness

- [ ] 0.1 确认 `materialize-selected-index-state` 已完成公共 API、decision-records 选择性暂存的强制接入和全部验证。
- [x] 0.2 核对 topic/case 权威源、派生索引、companion files、pending 和 filesystem 的 owner 与数据流。
- [x] 0.3 完成路径、topic 表、首次集合、空 case 集、重命名、完整 pending 替换和代码范围排除审阅；`Open Questions` 为“无”。

## Implementation

- [ ] 1.1 建立测试证据选择性暂存长期决策并保持 `unaligned`。
- [ ] 1.2 实现 revision/filesystem topic/case adapter、基线 state、选择变化、目标 metadata/`sourceRevision` 与 companion files。
- [ ] 1.3 实现 `stage <case-path...>`，调用 `index-runtime` 物化索引并调用 version-control 替换 `pending` 范围。
- [ ] 1.4 更新 test-evidence-review 的行为入口、固定契约、人类说明和独立版本。
- [ ] 1.5 同步 JSON 结果 Schema、公共声明、自包含 CLI 和 source map。
- [ ] 1.6 完成事实核对后把长期决策标记为 `aligned`。

## Verification

- [ ] 2.1 覆盖并行 A/B、既有 pending、范围外保留、新增/修改/删除/重命名、首次集合、空 case 集、revision topic 表和同源索引。
- [ ] 2.2 覆盖未知 topic、重复 case ID、非法路径、不支持成员、无仓库、revision 冲突和写入恢复，并回归 topics/check/sync/list/show。
- [ ] 2.3 确认 stage 不修改 filesystem、不读取 Entry 扩大范围，也不自动暂存代码。
- [ ] 2.4 为新增或修改测试入口维护独立测试证据 case，并同步索引。
- [ ] 2.5 运行 `bun run test:test-evidence-cli`、生成漂移、类型检查、严格目录检查与 `bun run check`，审阅最终 diff。
