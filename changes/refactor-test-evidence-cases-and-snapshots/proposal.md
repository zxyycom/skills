# Proposal

将 `test-evidence-review` 重构为独立 Case、tags、派生查询索引与项目实体 JSON 快照协作的测试证据能力。本文定义结果与范围，[design.md](design.md) 定义实施契约，[tasks.md](tasks.md) 定义任务依赖与验收门禁。

## Why

当前 [skill](../../skills/test-evidence-review/SKILL.md) 将一个最小原生测试入口等同于一个 Case，并以受控 Topic 组织文件。测试重命名、拆分和合并会牵动证据组织，跨领域 Case 又受唯一分类归属限制。

Case 应表达稳定的验证意图，证明点留在 Case 内，测试实体 ID 列表允许多对多引用。项目自行发现实体并交付 JSON，核心只消费快照、检查引用与管理 Case；skill 继续审查证明价值。测试规模增长由派生索引支持，不再增加总账文档、Topic 或关系图。

[Vibe Check 调查报告](../../docs/investigations/investigate-vibe-check-test-evidence.md) 提供了 Case 级多对多与项目级发现的使用证据。本 Change 不复制其将 Case 存储和查询也下放项目的边界。

## Outcome

使用者能够维护独立、带 tags 的 Case Markdown，通过索引定位 Case、读取原文和搜索正文；项目生成实体 JSON 后主动调用检查接口。Case、查询索引和实体快照分别拥有证据声明、查询投影与实体事实输入，检查结果不混淆快照引用有效、源码当前性、测试运行通过和证明价值。

## Scope

### Intended Change

- 一个 Markdown 文件一个 Case，保存稳定 ID、标题、Tests、可选 Tags、Contract 和 Proves；保持 Case 级多对多引用。
- 用 tags 取代受控 Topic，保留可重建的 Case 查询索引；结构化查询读取索引快照，原文展开和全文搜索读取 Case。
- 通过显式实体 JSON 与 expected source 输入提供引用检查 API/CLI；核心不采集、不回调项目、不执行 locator。
- 定义测试结构变化时的 Case 语义维护流程，以及 Case、索引、快照和证明价值各自的检查边界。

### Resulting Impacts

- 从已有 ledger 源码复用 Case 解析、tags 和 Index Runtime 适配，移除实体快照与索引的绑定、强制反向覆盖及旧 Topic 实现，保留唯一公开分发入口。
- 主仓库新增项目级快照生产和检查编排，将当前 `test:*` 中的原生实体接入新协议；核心不继承本仓库的 Bun 发现方式或全测试登记策略。
- 迁移现有 Case 和索引，保留连续的 Case ID、Contract 与 Proves；测试删除或语义改变仍显式维护，不由迁移工具猜测。
- 同步受影响的项目规则、长期决策、公开声明、Schema、构建、版本、测试与分发产物；补齐项目采集所需的锁定依赖、环境诊断和 CI 验证；明确旧命令和目录的退出路径。

## Success Criteria

- S1：Case 是唯一人工维护的证据声明；无 Topic、Case 关系图、证明点级映射或人工反向实体表。
- S2：一个 Case 多实体、一个实体多 Case 合法；重复 Case ID、空 Tests、重复引用及非法 tags 被拒绝。
- S3：list/tags 不读取 Case 正文或实体 JSON；索引可以仅从 Case 重建。show 核对来源身份，search 搜索权威正文；所有查询明确自己的快照与完整性边界。
- S4：引用检查消费显式 JSON 和预期来源，拒绝坏输入、部分快照、来源不匹配和未知引用；未被任何 Case 引用的实体不使核心检查失败。
- S5：核心不运行测试或采集命令，不调用网络或项目回调；索引同步/暂存仅保留既有版本控制能力；检查成功只证明相对于输入快照的引用有效，不证明测试通过或语义充分。
- S6：主仓库生产器可收集静态命名和参数化节点，包含 Node 专用测试声明但不改其执行器；注册/采集失败或输入漂移时不发布成功快照。
- S7：迁移可预演且不覆盖无关文件，保留连续身份和原文语义；旧格式在最终运行时明确拒绝，不保留自动双读。
- S8：源码、CLI/API、分发模块、项目接入、迁移、规模与阅读路径验收通过；Implementation/Verification 只按实际证据勾选。

## Affected Owners

| Owner | 实施责任 |
| --- | --- |
| [skill 与 references](../../skills/test-evidence-review/) | 行为入口、Case/快照/查询契约、迁移说明和版本 |
| [工具源码与测试](../../tools/test-evidence/) | 统一 Case 运行时、公开 API/CLI、引用检查和行为证据 |
| [Index Runtime](../../tools/index-runtime/README.md)、[正文搜索](../../tools/shared/src/file-text-search/index.ts) | 复用既有索引及文件搜索；不改变共享协议 |
| [构建适配](../../scripts/build/test-evidence.ts) | 唯一 MJS、声明、Schema 与生成物清理 |
| [项目脚本](../../scripts/)、[package.json](../../package.json)、[Gate](../../scripts/lib/vibe-gate.ts) | 快照生产、项目覆盖检查、迁移与维护命令 |
| [依赖锁](../../pnpm-lock.yaml)、[pnpm 配置](../../pnpm-workspace.yaml)、[环境入口](../../scripts/environment.js)、[CI](../../.github/workflows/package-skills.yml) | 项目本地 ast-grep 与 XML 解析依赖、安装许可和版本验证，不扩展核心分发依赖 |
| [现有 Case 集合](../../docs/test-evidence/) | 按 design 的切换事务迁移源文件与索引 |
| [AGENTS](../../AGENTS.md)、[导航](../../docs/navigation.md)、[工具链](../../docs/tooling.md)、[人类说明](../../docs/skills/test-evidence-review.md) | 同步当前规则、owner、入口与验证责任 |
| [长期决策](../../docs/decisions/) | 显式修订一对一、Topic、固定输入与强制双向闭合判断 |
