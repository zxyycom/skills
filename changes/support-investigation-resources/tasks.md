# Tasks

按契约、领域实现、分发生成和证据验证的依赖顺序完成调查资源能力，并以完整集合检查与决策对齐作为出口。

## Readiness

- [x] 0.1 审阅 proposal、design 和 tasks，确认统一资源池、报告级 Markdown 引用、主题索引关系投影与资源哈希围绕同一结果，且没有扩大为独立资源系统。
- [x] 0.2 核对 investigation-report、主题索引决策、资源方向、生成产物和测试证据 owner，确认固定语法、索引形状、快照边界和验证范围已经闭合，Open Questions 为无。

## Implementation

- [ ] 1.1 更新 `investigation-report` 行为入口、固定契约、人类介绍和索引 Schema，定义资源使用条件、报告链接元数据、正文责任、目录、索引投影和历史维护语义。
- [ ] 1.2 扩展调查 Markdown 解析、资源 ID 模型、集合发现和校验，实现 `_resources/`、报告级链接、共享引用、孤儿拒绝、路径安全、普通文件与符号链接边界。
- [ ] 1.3 扩展主题 state、集合 metadata、索引 definition version 和 `sourceRevision`，确定性生成 `resourceReferences` 与资源 SHA-256，并保证同步写前复核覆盖主题和资源快照。
- [ ] 1.4 更新默认检查、局部检查和 `list` 的新鲜度与资源级诊断，更新 TypeScript 声明、skill 版本、agent metadata 和构建后的自包含分发产物；无资源主题只需要重新同步索引。
- [ ] 1.5 增加成功、共享、文本、二进制、缺失、变化、重命名、越界、大小写不一致、符号链接和孤儿场景测试，并按 `test-evidence-review` 更新对应 case 与派生索引。

## Verification

- [ ] 2.1 运行 investigation-report 最小原生测试入口，证明解析、目录发现、索引构建、查询前新鲜度、CLI、Schema 和 Node 分发行为。
- [ ] 2.2 使用包含多报告、共享文本资源和二进制资源的临时调查集合运行 `sync-index`、默认 `check`、局部 `check` 与 `list`，核对报告关系和 SHA-256 投影，并验证资源变化会使旧索引失效且诊断定位 ID。
- [ ] 2.3 运行 skill 结构、生成状态、索引 Schema 和主仓库 `bun run check`，确认无资源主题兼容、definition version 迁移和测试证据账本一致。
- [ ] 2.4 将资源决策逐项与最终事实 owner 核对；全部方向实现后标记为 aligned，再运行决策严格检查并审阅最终 diff 没有纳入无关改动。
