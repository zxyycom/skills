# Readiness Audit

本文件冻结 `adopt-tagged-decision-records` 进入 Plan 时的只读基线，并提供本次手工切换的逐项核对清单。它不是运行时输入、Schema、升级工具或实施授权；实施开始时仍须按 `tasks.md` 重新核对最新 revision、并行写入所有权和关系事务。

## 审计基线

| 项目 | 已核实结果 |
| --- | --- |
| Revision | Plan 基线与审计时 `HEAD` 均为 `2bd527c931e68e376222cc67c268c6e3c2b5ae5a`。 |
| 严格集合检查 | `20` 个 domains、`274` 条已建立记录、`113` 条 active、`161` 条 archived、`0` 条 candidate；检查通过。 |
| 身份映射 | `274` 个 basename 全部符合目标 kebab-case Markdown 语法且全局唯一；目标 ID 集合无冲突。 |
| 关系闭包 | `185` 条记录包含关系，共 `217` 条直接关系；全部目标可在当前已建立集合中解析。 |
| 来源快照 | `sourceRevision.entries` 与已建立记录均为 `274` 项；当前 entry ID、`state.path` 和来源 revision key 一致。 |
| CodeGraph 影响 | 索引共 `337` 个文件、`23,536` 个节点、`96,910` 条边；源码 `DecisionIndexState` 影响 `101` 个符号，`scanDecisionRecords` 影响 `37` 个，`parseDecisionMarkdown` 影响 `22` 个，`createDecisionStateIndexDefinition` 影响 `35` 个。 |
| 当前格式版本 | Decision Records skill `metadata.version` 为 `25`；通用索引 `schemaVersion` 为 `3`，领域定义 `definitionVersion` 为 `5`，metadata 保存 `domains`。 |
| 生成边界 | `scripts/build/decision-records.ts` 从 `tools/decision-records/` 源码与手写声明生成 CLI bundle、source map、声明和 Decision Index Schema；实施必须改 owner 后再同步产物。 |
| Active Changes | `change-plan check-all` 核实 `9` 个 active Change 全部有效。两个相邻标签化 Change 不提供本 Plan 的共享协议；Task Graph 与 Test Evidence 相关 Plan 可能在实施期写入决策或证据，届时必须重新核对并串行化写入。 |
| 工作区归因 | 审计时工作区改动均可归因于本 Change 文档、直接引用修正和派生调查索引同步；未发现需吸收的无关改动。 |

上述数字是 Plan 基线证据，不是未来实施的缓存事实。任务 1.1 将“重新检查最新 revision”与首次决策写入放在同一个执行门禁中。

## 映射规则

对每条既有记录应用同一人工核对规则：

1. 旧 `<domain-id>/<basename>` 同时是旧 ID 和旧 `sourcePath`；目标 Decision ID 只取 `<basename>`。
2. active 或 candidate 的目标 `sourcePath` 为 `<basename>`；archived 的目标 `sourcePath` 为 `archive/<basename>`。
3. 初始 tag 使用原 `domain-id`；额外 tag 只有在记录正文提供依据时才增加。
4. 每条 `relations[].target` 保留关系类型，但把目标从旧路径改为目标 basename。
5. `readiness-inventory.json` 中的完整 `inputSourceRevision` 指纹用于确认输入成员没有漂移；内容语义不复制到审计附件，最终由 Git diff 逐项比较 title、摘要、正文、状态、对齐和建立时间。

本清单规范化后的 SHA-256 为 `sha256:e6422b0c23ad0b5cd3948cffa4f61c736687cddfab134f88f766926b68c7cd64`。该摘要只校验本文件中的审计输入，不替代权威 Markdown 或目标 checker。

## 计划新增的后继

| 后继 Decision ID | 旧模型建立位置 | 目标位置 | 初始 tag | 建立后状态 |
| --- | --- | --- | --- | --- |
| `use-stable-decision-ids-tags-and-location-index.md` | `decision-records/use-stable-decision-ids-tags-and-location-index.md` | `use-stable-decision-ids-tags-and-location-index.md` | `decision-records` | active + unaligned |
| `stage-selected-decisions-by-stable-id.md` | `decision-records/stage-selected-decisions-by-stable-id.md` | `stage-selected-decisions-by-stable-id.md` | `decision-records` | active + unaligned |

这两个名称是 Plan 的预期输入。实施时必须先确认没有同名记录或并行后继，再创建完整 candidate；不能从本表直接生成或激活 Markdown。

## 关系事务预览

| 后继 | 直接前序 | 预期关系 | 必须保留或退出的含义 |
| --- | --- | --- | --- |
| `use-stable-decision-ids-tags-and-location-index.md` | `classify-decisions-by-controlled-domain-path.md` | 归并 | 退出领域路径身份与唯一领域归属，由稳定 ID 和记录级 tags 承接。 |
| `use-stable-decision-ids-tags-and-location-index.md` | `project-domains-into-decision-queries.md` | 归并 | 退出领域目录投影和 domain 查询，由 tag/status/alignment 查询投影承接。 |
| `use-stable-decision-ids-tags-and-location-index.md` | `use-persisted-index-for-routine-queries.md` | 修订 | 保留持久索引、默认 active 和 show 单正文读取，改为 ID 与 `sourcePath` 定位。 |
| `use-stable-decision-ids-tags-and-location-index.md` | `query-candidates-directly-from-source.md` | 修订 | 保留候选源码发现和逐文件容错，改用根目录 candidate 集合边界。 |
| `use-stable-decision-ids-tags-and-location-index.md` | `upgrade-decision-domains-after-real-pressure.md` | 替代 | 让不再存在的 domain 谱系方向退出；分类重组改由非身份 tags 完成。 |
| `stage-selected-decisions-by-stable-id.md` | `stage-selected-decisions.md` | 修订 | 保留完整索引、显式选择、pending 隔离和原子替换，选择单位改为稳定 ID。 |

- 上述六个直接前序在审计时均为 active，且都存在于 Plan 基线的 Git tree；四个当前基线为 aligned，一个 domain 升级方向为 unaligned，stage 基线为 aligned。
- 核心后继是单后继混合关系集合，其中两条 `归并` 共同承接身份和查询投影；当前关系策略允许单后继使用混合关系，且不会触发“纯 `归并` 至少两个前序”之外的闭合要求。
- `use-physical-archive-boundary-for-decision-search.md` 不作为前序归档：它继续保持 active + unaligned，待物理归档完整落地后再按事实标记 aligned。
- `make-independent-decision-staging-discoverable.md`、持久查询成本边界、候选容错和 pending 隔离中仍独立成立的判断不得因后继事务静默退出。
- Readiness 只保存关系预览证据，不写入 candidate、不执行 `evolve`、不改变长期决策；实际事务由任务 1.1 从最新 Git 历史和完整关系图重新预检后执行。

## Domain description 处置

20 条 description 都是对应能力或项目 owner 的概览，不包含必须从领域表抢救的独有规范。删除 `decision-domains.json` 时不迁写这些句子；下列现有 owner 继续承接稳定含义。

| 旧 domain | 当前 description | 稳定 owner | 处置 |
| --- | --- | --- | --- | --- |
| `ai-ready-docs` | 让说明、规则、任务与工作流能被 AI 准确理解、可靠执行和检查。 | `skills/ai-ready-docs/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `change-plan` | 维护明确变更的提案、设计、任务分解与基础生命周期。 | `skills/change-plan/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `common-denominator-design` | 识别多个现实场景共同依赖的契约边界，并确定公约数的数量与层次。 | `skills/common-denominator-design/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `decision-records` | 维护长期决策的记录契约、生命周期、索引、查询与演进关系。 | `skills/decision-records/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `dependency-boundary-design` | 判断分散依赖调用是否需要收口，并形成明确的依赖责任边界。 | `skills/dependency-boundary-design/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `git-commit-organizer` | 整理 Git 改动并形成范围清楚、语义准确且可追踪的提交。 | `skills/git-commit-organizer/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `index-runtime` | 提供跨领域派生状态索引的定义、校验、查询、同步和存储协议。 | `tools/index-runtime/README.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `investigation-report` | 维护可独立复核和比较的调查报告、索引与演进边界。 | `skills/investigation-report/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `minimal-implementation` | 在目标和责任明确后比较正确候选的整体维护面，并选择更小方案。 | `skills/minimal-implementation/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `openspec` | 维护 OpenSpec change 从探索、提案、实施到归档的阶段工作流。 | `docs/skills/openspec-skills.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `product-architecture-judgment` | 从产品价值和架构责任判断工程事项是否该做、做到什么程度以及由谁实现。 | `skills/product-architecture-judgment/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `project-documentation` | 维护仓库级说明、导航、协作约定和编码规范等文档 owner。 | `docs/navigation.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `project-tooling` | 维护仓库开发环境、校验、生成、打包、CI、发布和更新工具链。 | `docs/tooling.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `repository-model` | 定义仓库定位、skill 选择与启用边界、集中维护和通用分发边界。 | `docs/repository-model.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `skill-design-discovery` | 从现实材料恢复 skill 所需流程、判断、约束、权限和验证义务。 | `skills/skill-design-discovery/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `skill-maintainer` | 维护 skill 的能力归属、组成、分发单元和交付边界。 | `skills/skill-maintainer/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `subagent-orchestration` | 维护复杂任务的子代理拆分、上下文控制、写入所有权和结果审计。 | `skills/subagent-orchestration/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `task-graph` | 维护可恢复任务图的权威状态、拓扑关系、并发调度和生命周期边界。 | `skills/task-graph/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `test-evidence-review` | 审查最小原生测试实体的证据，维护 Test–Case 关系、派生索引、runner 结果边界与正式结果资格。 | `skills/test-evidence-review/SKILL.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |
| `version-control` | 提供工具共享的版本控制快照、路径、变更读取与受控待提交写入协议。 | `tools/shared/version-control.md` | 已有 owner，无需迁写；随领域表删除目录投影。 |

## 引用处置清单

基线搜索共发现 Decision Records 自身关系 `217` 条，以及集合外直接 `docs/decisions/...md` 路径命中 `182` 处。实施时按 owner 和形成语义处理，不做机械全仓替换。

| 引用类别 | 基线数量 | 处置 |
| --- | ---: | --- |
| 本 Change 的设计链接 | 3 | 实施切换时更新为目标物理路径；Change 归档前继续保持可读。 |
| 其他 active Change | 11 | 逐文件确认仍是当前依赖后更新；若届时已归档，则按历史 Change 文档规则保留。 |
| 当前 Investigation Report 的本地路径 | 2 | 按 Investigation Report owner 修正当前可维护链接并同步派生索引。 |
| 当前 Investigation Report 的固定 revision 外链 | 1 | 链接指向形成时 GitHub revision，保留不改。 |
| `docs/task-graph/task-graph-index.json` | 111 | 作为结构化语义引用交给 Task Graph owner 逐字段判断；可维护当前引用按其事务更新，已锚定终态结果或形成时上下文不机械重写。 |
| 已归档 Change | 42 | 保留形成时文档，不重写。 |
| Investigation `_resources` | 12 | 保留形成时字节，不重写。 |
| active 决策正文中的决策链接 | 1 | 作为不改变判断语义的当前链接修正，随目标路径更新。 |
| archived 决策正文中的旧路径文本 | 3 | 保留历史正文，不把当前布局倒写进已归档判断。 |
| Decision Records `relations[].target` | 217 | 按 `readiness-inventory.json` 逐项保留类型并改为目标 Decision ID。 |

普通仓库外链接不在本仓库可枚举范围内；不提供 permalink、重定向、symlink 或升级辅助。

## 既有记录逐项清单

274 条既有记录的精确映射保存在 [`readiness-inventory.json`](readiness-inventory.json)。该 JSON 是本审计的按需展开视图，不是运行时输入或可执行迁移 manifest；实施者只有在执行逐项切换、漂移检查和最终对账时才需要读取它。

| 字段 | 核对含义 |
| --- | --- |
| `oldId` / `oldSourcePath` | 旧模型中的路径身份和当前物理来源。 |
| `targetId` | 目标 basename Decision ID。 |
| `targetSourcePath` | 按 status 派生的目标根目录或 `archive/` 路径。 |
| `initialTag` | 从旧 domain 得到的最低限度初始 tags。 |
| `status` / `alignment` | 切换时必须保持的生命周期与对齐事实。 |
| `targetRelations` | 保留关系类型、只把目标改为 basename ID 后的完整直接关系。 |
| `inputSourceRevision` | 证明审计输入未漂移的完整来源指纹。 |

清单总计：274 条既有记录；其中 active 113 条、archived 161 条、candidate 0 条；关系 217 条。计划新增的两个后继单独列在前文，不计入这 274 条基线。
