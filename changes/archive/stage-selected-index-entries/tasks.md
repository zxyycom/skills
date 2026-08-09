# Tasks

任务按“确认前置索引契约 → 组合目标条目与来源 revision → 受锁暂存 → 公共入口与验证”推进；完成出口是调用方只传选中 id 即可安全暂存目标索引条目。

## Readiness

- [x] 0.1 确认核心目的只是解决单文件索引无法按条目独立暂存的问题；index-runtime 只暂存自己的索引文件，领域文件由接入方负责。
- [x] 0.2 确认公共选择输入只有稳定条目 id；revision 索引是基线，工作区索引是候选，新增、修改、删除和显式重命名使用同一存在性规则。
- [x] 0.3 确认同一索引已有待提交变化时直接拒绝，并在 version-control 写入锁内核对；其他待提交路径保持不变。
- [x] 0.4 确认条目级操作不选择 metadata、metadata 来源指纹或 definition；目标逐条来源 revision 与 state 使用同一 id 选择规则。
- [x] 0.5 确认 `use-id-keyed-state-index.md` 与 `stage-selected-index-entries-by-id.md` 是从同一粗决策闭合拆分出的独立长期判断，分别承接前置索引契约与本 change 的选择性暂存方向；三个 artifact 使用同一主承诺和责任边界。
- [x] 0.6 确认前置 `use-id-keyed-state-index` change 已归档完成，schema v3 与结构化来源 revision 决策为 `active + aligned`，可以开始本 change 的实现。

## Implementation

- [x] 1.1 提取从 metadata、id 键控 state 与逐条来源 revision 构造完整目标索引的内部路径，统一复用 parser、key 投影、字段顺序、规范化和完整 `validateIndex`。
- [x] 1.2 扩展 version-control 的 `replacePendingFiles`，使它能在既有写入锁内核对目标路径的期望 `pending` 内容，并保持范围外内容、读回验证和失败恢复语义。
- [x] 1.3 实现 `stageSelectedIndexEntries`：校验路径和 selectedIds，读取 revision/工作区索引，按 id 同步选择 state 与来源指纹，拒绝集合级变化，重建完整目标并处理稳定诊断。
- [x] 1.4 为 `StateIndexRuntime` 增加只接收 selectedIds 的 `stageSelectedEntries`，同步公共类型、导出和 README；通过官方构建入口同步实际漂移的分发模块，并提升包内容发生变化的 skill 版本。
- [x] 1.5 在实现、稳定 owner 和事实核对完成后，把 `index-runtime/stage-selected-index-entries-by-id.md` 标记为 `aligned` 并同步统一决策索引。

## Verification

- [x] 2.1 验证 revision `A0/B0/C0` 与工作区 `A1/B1/C1` 选择 `A/C` 得到 `A1/B0/C1`，state 与逐条来源指纹始终成对选择；覆盖修改、新增、删除、无实际变化、首次索引、合法空结果和同时选择旧/新 id 的重命名。
- [x] 2.2 验证未选中的工作区 state 与来源指纹不进入目标；输入顺序不影响结果，空选择、重复或非法 id、两边都缺失的 id、无效索引和 definition 不匹配使用稳定诊断失败。
- [x] 2.3 验证既有基线下 metadata、metadata 来源指纹或其他集合级契约改变，以及合并后的 id/key/revision 集合/完整领域校验失败，都发生在 `pending` 写入前；首次索引使用工作区完整集合级契约。
- [x] 2.4 在临时版本仓库验证目标索引 `pending` 干净时成功、已有同索引待提交内容时直接拒绝、目标外既有 `pending` 保持不变，并且工作区索引和领域文件始终不变。
- [x] 2.5 验证两个并发调用不能互相覆盖：一个成功后另一个因锁内期望不再成立而失败；current revision 改变、锁冲突、写入失败和恢复失败遵守 version-control 契约。
- [x] 2.6 回归 index-runtime 的解析、完整校验、确定性序列化与 schema v3 来源 revision 契约；本操作不调用领域 `read` / `readRevision`。
- [x] 2.7 为新增或修改的最小测试入口维护独立测试证据 case 并同步统一索引；运行 index-runtime、version-control、类型检查、生成漂移、严格目录检查和 `bun run check`，最后审阅依赖方向与 diff。
