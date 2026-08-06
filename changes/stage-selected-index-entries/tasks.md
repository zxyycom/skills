# Tasks

任务按“已确认契约 → 索引重建与 revision → 受锁暂存 → 公共入口与验证”推进；完成出口是调用方只传选中 id 即可安全暂存目标索引条目。

## Readiness

- [x] 0.1 确认核心目的只是解决单文件索引无法按条目独立暂存的问题；index-runtime 只暂存自己的索引文件，领域文件由接入方负责。
- [x] 0.2 确认公共选择输入只有稳定条目 id；revision 索引是基线，工作区索引是候选，新增、修改、删除和显式重命名使用同一存在性规则。
- [x] 0.3 确认同一索引已有待提交变化时直接拒绝，并在 version-control 写入锁内核对；其他待提交路径保持不变。
- [x] 0.4 确认条目级操作不选择 metadata 或 definition，目标 revision 必须由最终规范化索引投影统一派生。
- [x] 0.5 建立 `index-runtime/stage-selected-index-entries.md` 长期决策并保持 `active + unaligned`；proposal、design 和 tasks 已按同一主承诺完成 AI-ready 审阅。

## Implementation

- [ ] 1.1 在 index-runtime 中建立规范化 projection revision 的唯一实现，让完整构建、解析自检和选择结果重建得到同一 `sourceRevision`；保留 `StateSnapshot.revision` 与 `readRevision`，但取消领域自定义 revision 和低成本读取承诺。
- [ ] 1.2 提取从 metadata 与 state 直接构造完整索引的内部路径，统一复用解析、id/key 投影、字段顺序、规范化和完整 `validateIndex`。
- [ ] 1.3 扩展 version-control 的 `replacePendingFiles`，使它能在既有写入锁内核对目标路径的期望 `pending` 内容，并保持范围外内容、读回验证和失败恢复语义。
- [ ] 1.4 实现 `stageSelectedIndexEntries`：校验路径和 selectedIds，读取 revision/工作区索引，按 id 合并条目，拒绝 metadata/definition 变化，重建完整目标并处理稳定诊断。
- [ ] 1.5 为 `StateIndexRuntime` 增加只接收 selectedIds 的 `stageSelectedEntries`，同步公共类型、导出、README 和必要生成模块。
- [ ] 1.6 迁移 decision-records、investigation-report 和 test-evidence 的现有索引构建与 revision 校验，使普通 build/load/check/sync 使用统一 projection revision；不在此任务中新增它们的领域文件暂存流程。
- [ ] 1.7 在实现、稳定 owner、生成产物和事实核对完成后，把 `index-runtime/stage-selected-index-entries.md` 标记为 `aligned` 并同步统一决策索引。

## Verification

- [ ] 2.1 验证 projection revision 对相同规范化索引稳定，对 metadata、成员、state、id、keys、namespace 或 definitionVersion 变化敏感，并由完整构建与选择性暂存共同复用。
- [ ] 2.2 验证 revision `A0/B0/C0` 与工作区 `A1/B1/C1` 选择 `A/C` 得到 `A1/B0/C1`；覆盖修改、新增、删除、无实际变化、首次索引、合法空结果和同时选择旧/新 id 的重命名。
- [ ] 2.3 验证未选中的工作区变化不进入目标；输入顺序不影响结果，空选择、重复或非法 id、两边都缺失的 id、无效索引和 definition 不匹配使用稳定诊断失败。
- [ ] 2.4 验证既有基线下 metadata 改变以及合并后的 id/key/完整领域校验失败都发生在 `pending` 写入前；首次索引使用工作区 metadata。
- [ ] 2.5 在临时版本仓库验证目标索引 `pending` 干净时成功、已有同索引待提交内容时直接拒绝、目标外既有 `pending` 保持不变，并且工作区索引和领域文件始终不变。
- [ ] 2.6 验证两个并发调用不能互相覆盖：一个成功后另一个因锁内期望不再成立而失败；current revision 改变、锁冲突、写入失败和恢复失败遵守 version-control 契约。
- [ ] 2.7 回归 index-runtime 的读取、查询、runtime overlay、完整同步、确定性序列化和规模场景，以及三个现有消费者的 build/load/check/sync 与生成漂移。
- [ ] 2.8 为新增或修改的最小测试入口维护独立测试证据 case 并同步统一索引；运行 index-runtime、version-control、受影响消费者、类型检查、生成漂移、严格目录检查和 `bun run check`，最后审阅依赖方向与 diff。
