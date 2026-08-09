# Tasks

先交付“允许报告按需引用资源并管理已声明引用”的能力，再补齐资源完整性、索引投影、分发与验证；索引和哈希只服务于引用能够可靠恢复。

## Readiness

- [x] 0.1 确认本 change 的核心结果是允许 H3 调查报告按需通过本地链接引用资源，并管理已经声明的引用及其文件；报告不引用资源时继续合法，多资源、共享资源、索引关系和 SHA-256 都围绕可选引用展开。
- [x] 0.2 核对当前 schema v3 ID 键控索引、结构化 source revision、investigation-report 固定契约、主题级索引决策和资源长期方向，确认关系进入主题 state、资源摘要进入 metadata、资源变化进入 `sourceRevision.metadata`。
- [x] 0.3 确认不建立独立资源系统，不迁移现有报告，不扩展通用 index-runtime 或 Git 暂存能力；资源变化需要完整暂存调查索引是已知边界，Open Questions 为无。

## Implementation

- [ ] 1.1 更新 `investigation-report` 行为入口、固定契约和人类说明，定义资源使用条件、报告 `随附资源` 链接语法、正文责任、资源池、共享与历史维护语义。
- [ ] 1.2 扩展 Markdown AST 解析、报告投影、领域类型和主题 state 构建，从声明了 `随附资源` 的报告恢复资源链接，保持无资源报告兼容，并拒绝非法字段结构、空展示文字和报告内重复资源。
- [ ] 1.3 实现 `_resources/` 发现和安全资源 ID，校验规范路径、实际大小写、普通文件、路径分量与符号链接、缺失目标、共享引用和全局孤儿资源。
- [ ] 1.4 扩展调查 definition、metadata 和 source revision，生成 `state.resourceReferences`、资源 SHA-256 与 `sourceRevision.metadata`，并让同步写前复核、默认 `check`、局部 `check` 和 `list` 提供对应完整性与资源级诊断。
- [ ] 1.5 提升调查领域 definition version 和 skill 版本，更新 JSON Schema、公共声明、自包含 CLI、source map，并重新同步当前无资源调查集合的 `investigation-index.json`。
- [ ] 1.6 增加单资源、多资源、共享、文本、二进制、缺失、内容变化、重命名、越界、大小写不一致、符号链接、非普通文件和孤儿场景测试，并按 `test-evidence-review` 更新对应 case 与派生索引。

## Verification

- [ ] 2.1 运行 investigation-report 最小原生测试入口，证明报告解析、资源发现、主题 state、metadata、source revision、索引构建、查询前新鲜度、CLI、Schema 和 Node 分发行为。
- [ ] 2.2 在临时调查集合中同时覆盖无资源报告和声明资源引用的报告，再覆盖单资源、多资源、共享文本资源和二进制资源；运行 `sync-index`、默认 `check`、局部 `check` 与 `list`，核对已声明关系和 SHA-256，并验证资源变化会使旧索引失效且诊断定位资源 ID。
- [ ] 2.3 运行 skill 结构、生成漂移、类型检查、索引 Schema、当前调查集合检查和主仓库 `bun run check`，确认无资源报告兼容、definition version 迁移和测试证据账本一致。
- [ ] 2.4 将资源长期决策逐项与最终事实 owner 核对；完整方向落地后才标记为 aligned，再运行决策严格检查并审阅最终 diff 没有纳入无关改动。
