# Tasks

任务按“固定 id/revision 契约 → 迁移通用运行时 → 迁移消费者与产物 → 验证性能和兼容边界”推进；完成出口是三个领域都使用 schema v3 的 id 键控索引，并保持轻量新鲜度检查。

## Readiness

- [x] 0.1 确认本 change 只拥有 id 键控索引格式、来源 revision 和快速读取契约；选择性 `pending` 写入继续由 `stage-selected-index-entries` 负责。
- [x] 0.2 确认 snapshot、持久化 entries、runtime overlay 与来源 revision 条目使用 id record；查询结果、key definitions 和其他有序或多值集合继续使用数组。
- [x] 0.3 确认快速新鲜度路径保留一次来源扫描且不执行领域 state parser；逐 id 指纹在同一遍读取中产生。
- [x] 0.4 确认 schema v3 不保留 schema v2 兼容层，三个现有消费者和派生索引在同一实施中迁移。
- [x] 0.5 建立两条闭合后继长期决策并保持 `active + unaligned`；proposal、design 和 tasks 已围绕同一主承诺完成 AI-ready 审阅，且没有阻塞开放问题。

## Implementation

- [ ] 1.1 在 index-runtime 中建立 schema v3 的 `StateRecord`、stored entry、query entry、`StateSourceRevision`、snapshot、readonly index 和 public export 类型，并删除 definition 的 `identify`。
- [ ] 1.2 改造 definition、snapshot build、projection、normalization、validation、freeze 和 serialization，使 id 在 parser/key context 中显式可用，并让 entries 与 source revision records 按 id 确定性处理。
- [ ] 1.3 改造 index JSON 解析边界，拒绝重复 entry id，安全处理原型敏感 id，并为 schema v2、id 集合不一致和来源 revision 非法提供稳定诊断。
- [ ] 1.4 改造 storage/runtime/query，使 `readRevision` 返回结构化清单、reader 只在打开时检查一次、静态 `get` 直接查找且 runtime overlay 使用 id record；保留既有过滤、排序和分页结果。
- [ ] 1.5 迁移 decision-records、investigation-report 与 test-evidence 的 snapshot/source reader，在同一遍来源读取中提供 metadata 与逐 id 指纹，并同步 parser、key strategy、完整校验和查询调用方。
- [ ] 1.6 升级三个领域的 JSON Schema、API 声明、fixture、生成模块和随 skill 分发产物，重建 decision、investigation 与 test-evidence 派生索引，且不手工编辑索引内容。
- [ ] 1.7 更新 index-runtime README 与必要稳定 owner，明确 id record、来源 revision、快速读取、数组保留边界和 schema v3 迁移方式。
- [ ] 1.8 在实现与稳定 owner 完整核对后，把 `index-runtime/use-id-keyed-state-index.md` 标记为 `aligned`，并为选择性暂存 change 提供已经对齐的前置契约。

## Verification

- [ ] 2.1 验证 snapshot state、持久化 entry、source revision 和 runtime overlay 的 id 集合规则，覆盖新增、替换、删除、空集合、非法 id、缺失/多余 revision 和输入顺序无关性。
- [ ] 2.2 验证 schema v3 确定性序列化、schema v2 拒绝、重复 JSON entry id 拒绝，以及 `__proto__`、`constructor` 等特殊 id 的 parse/build/get/query 往返。
- [ ] 2.3 验证 `parseState` 与 key strategy 获得正确 `{ id, metadata }`，stored entry 不保存 id，reader/query 输出正确附加 id，领域 state 内同名字段不被通用层解释。
- [ ] 2.4 验证完整 `read` 与快速 `readRevision` 对相同来源产生相同清单；metadata、成员和单条来源变化只产生契约要求的对应变化。
- [ ] 2.5 用调用计数证明一次 `open` 只执行一次来源发现/读取且不调用领域 state parser、key projection 或完整 builder；同一 reader 的后续 `get/query/all` 不重复检查。
- [ ] 2.6 对比迁移前后的千条 investigation-report 新鲜度读取与查询测量，确认保持百毫秒级而未接近完整解析重建成本；保留 index-runtime 一千/五千条构建与查询规模证据。
- [ ] 2.7 回归 exact/range/text/exists、排序、分页、metadata、完整 `validateIndex`、runtime overlay、原子同步、CRLF 等价和确定性字段顺序。
- [ ] 2.8 验证三个消费者的 build/load/check/sync/query、领域 Schema、生成漂移和派生索引一致，并为新增或修改的最小测试入口维护独立测试证据 case。
- [ ] 2.9 运行 index-runtime、decision-records、investigation-report、test-evidence、类型检查、生成检查、严格决策/调查/测试账本检查和 `bun run check`，最后审阅依赖方向与 diff。
