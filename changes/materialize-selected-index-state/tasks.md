# Tasks

任务按“公共契约 → index-runtime 实现 → decision-records 迁移 → 证据与对齐”推进；完成后调查与测试证据 change 才能开始其 stage 实现。

## Readiness

- [x] 0.1 核对领域派生索引、pending、Git index、权威源和 companion files 的术语与 owner，确认本 change 只修改索引物化。
- [x] 0.2 核对现有查询 overlay、snapshot builder、完整验证、`sourceRevision` 和 decision-records stage，确认新增/替换已有先例，而删除、目标 metadata、目标 `sourceRevision` 与持久物化仍是明确缺口。
- [x] 0.3 完成 snapshot 直建、选择变化、目标 metadata/`sourceRevision`、decision-records 强制接入、领域补充文件和 version-control 写入的分层审阅；`Open Questions` 为“无”。

## Implementation

- [ ] 1.1 建立或演进 index-runtime 长期决策，明确选择性索引物化与 companion/`pending` 边界。
- [ ] 1.2 提取并公开 snapshot 直建入口，让 filesystem builder 与内存调用方复用同一投影和完整校验。
- [ ] 1.3 实现选择性索引物化入口及类型，覆盖基线、upsert、delete、目标 metadata、目标 `sourceRevision` 和冲突诊断。
- [ ] 1.4 迁移 decision-records stage adapter：保留源文件 overlay、完整目标 snapshot 与关系校验，按选中路径形成 upsert/delete，并强制通过公共选择性物化入口生成最终索引；删除临时 definition reader 覆盖及其直接构建 stage 索引的路径，保持 `pending` 行为不变。
- [ ] 1.5 更新 index-runtime README、受影响 decision-records 实现说明与必要生成产物。
- [ ] 1.6 在实现与事实核对完成后将长期决策标记为 `aligned`。

## Verification

- [ ] 2.1 为 snapshot 直建与选择性物化覆盖新增、按基线 id 替换、删除、空基线、空结果、metadata 变化、目标 `sourceRevision`、重复/冲突变化和完整后置校验。
- [ ] 2.2 回归查询 runtime overlay、filesystem sync、解析、序列化、确定性和规模场景，确认既有行为未改变。
- [ ] 2.3 回归 `bun run test:decision-records-cli` 覆盖的 stage 与非 stage 命令，确认新增、修改、删除、显式重命名、首次集合、并行未选择变化、领域关系失败、权威源和 `pending` 结果保持一致。
- [ ] 2.4 增加 decision-records 接入证据，证明 stage 最终索引经过公共选择性物化入口，且不再使用临时 definition reader 直接构建 stage 索引。
- [ ] 2.5 为新增或修改的最小测试入口维护独立测试证据 case，并同步统一索引。
- [ ] 2.6 运行 `bun run test:index-runtime`、`bun run test:decision-records-cli`、类型检查、生成漂移、严格目录检查和 `bun run check`，审阅最终依赖方向与 diff。
