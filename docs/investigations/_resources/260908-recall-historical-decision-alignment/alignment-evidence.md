# 历史决策对齐召回：逐条证据

本资源节选每项的结果、历史定位和区分依据；方法、共同验证与推断边界见[主报告](../../recall-historical-decision-alignment.md)。可解析的 commit 以核对过唯一性的 12 位前缀表示；路径相对于历史仓库根。后续仅有格式、归档或摘要变化且未改变原方向的情况不逐条重复。

## 直接历史记录（31 条，均 aligned）

同一行的历史前版路径为 `revision:docs/decisions/<目录>/<ID>.md`。该前版记录 active/aligned，归档后同身份为 archived/null；它证明记录过的值，不证明当时实现。

| 前版 revision | 目录 | Decision ID |
| --- | --- | --- |
| `e4f35740be7f^` | `project-tooling` | `260702-use-monorepo-skills-directory`, `260703-follow-latest-release-for-skill-updater`, `260703-use-per-skill-hash-lock-for-updater`, `separate-distributable-tool-source-from-repository-automation` |
| `f7b64b007487^` | `project-tooling` | `260720-expose-importable-skill-modules`, `260720-use-prebuilt-git-test-fixtures` |
| `ddaae930689f^` | `decision-records` | `260720-focus-entry-on-behavior-routing`, `derive-establishment-from-markdown-lifecycle` |
| `ea0be0edecbe^` | `test-evidence-review` | `260720-map-test-entries-and-trigger-scoped-reviews`, `index-ledger-by-stable-case-state`, `publish-only-layered-test-evidence-interfaces`, `read-ledger-contract-on-demand` |
| `6aa9e1e7febb^` | `project-tooling` | `260720-orchestrate-checks-with-conservative-concurrency` |
| `efd1a3fadbac^` | `test-evidence-review` | `260720-organize-proofs-by-shared-execution-chain`, `review-verification-implementations-with-explicit-indexed-cases` |
| `8dd0c02b99a3^` | `decision-records` | `allow-sequential-activation-of-prewritten-candidates`, `query-projected-decision-metadata`, `separate-activation-effect-from-head-pending`, `use-configurable-self-contained-decision-root`, `use-field-alignment-commands`, `use-frontmatter-projection-and-semantic-field-order` |
| `f77bb607547b^` | `test-evidence-review` | `catalog-minimal-native-test-entries` |
| `8dd0c02b99a3^` | `decision-records-skill` | `complete-current-decision-work-by-task-outcome` |
| `45b5ea363456^` | `decision-records` | `express-alignment-as-field-relation` |
| `decb5a87b01d^` | `decision-records` | `generate-index-from-self-contained-decisions` |
| `034e0a15daeb^` | `test-evidence-review` | `organize-native-test-cases-by-responsibility-topic` |
| `8788cf110827^` | `test-evidence-review` | `organize-test-cases-by-controlled-topic-path` |
| `a92e00087d4e^` | `decision-records` | `recover-current-format-tools-and-index` |
| `ed5dc4b4e11c^` | `test-evidence-review` | `register-one-case-per-independent-verification-entry` |
| `a0079d351a22^` | `change-plan` | `use-independent-change-plans` |
| `8dd0c02b99a3^` | `index-runtime` | `use-independent-read-side-index-runtime` |

`recover-current-format-tools-and-index` 归档时将“schema v4”改为“当前索引/固定契约”，仍要求只恢复当前格式并由 Markdown 重建索引。

## 历史语义核对（57 条）

“复核”定位当时的同一决策；依据另列具体历史 tree 的实现或契约。明确列出的后续变化不意味着用后继状态取代原时点证据。

### `260713-recall-before-long-lived-changes` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records-skill/260713-recall-before-long-lived-changes.md`。
- 采用方向原记录：`6cdf156effa2`（路径同复核）。
- `9cb979ef6555:skills/decision-records/SKILL.md`：“主动读取”和“恢复当前判断”要求在长期决定或冲突前定位索引、读取必要 Markdown，并按对齐/例外/修订/一致性问题处理，落实该行为协议。
- `6cdf156effa2:scripts/decision-records/src/cli.ts`：实现 list、trace、activate、archive 和 JSON 索引校验入口，提供该恢复协议依赖的确定性当前/历史查询能力。

### `260713-use-json-current-index-and-stable-paths` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260713-use-json-current-index-and-stable-paths.md`。
- 采用方向原记录：`6cdf156effa2`（路径同复核）。
- `6cdf156effa2:scripts/decision-records/src/cli.ts`：CLI 将 list 默认限定当前集合，并以 activate/archive 维护成员、sync-index 仅刷新派生摘要，实际分离成员变更与投影刷新。
- `6cdf156effa2:scripts/decision-records/tests/run.ts`：历史测试夹具对 current/archived 列表、关系 trace、成员切换和索引漂移后的 sync-index 进行断言。

### `260718-add-direction-and-depth-to-trace` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260718-add-direction-and-depth-to-trace.md`。
- 采用方向原记录：`e019307576f4`（路径同复核）。
- `e019307576f4:scripts/decision-records/src/cli.ts`：runTrace 分别构建 predecessor/successor 邻接表，在队列携带 depth，并按 traceDirection 与 traceDepth 决定扩展。
- `e019307576f4:scripts/decision-records/tests/run.ts`：断言 predecessors 不返回后继、successors 返回反查后继，且 depth 1/2 分别截断或包含更早前序。

### `260718-notify-before-decision-writes` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records-skill/260718-notify-before-decision-writes.md`。
- 采用方向原记录：`e019307576f4`（路径同复核）。
- `e019307576f4:skills/decision-records/SKILL.md`：“区分任务意图”和完成标准直接要求不重复询问已表达的维护意图，并在集合变动前告知写入判断与集合变化。

### `260718-separate-behavior-entry-from-storage-contract` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260718-separate-behavior-entry-from-storage-contract.md`。
- 采用方向原记录：`f2d35755d89a`（路径同复核）。
- `f2d35755d89a:skills/decision-records/SKILL.md`：Owner 与读取步骤把语义恢复放在入口，将创建、修订、归档、修复和结构审阅前读取 reference 的门槛写入实际行为入口。
- `f2d35755d89a:skills/decision-records/references/decision-record-rules.md`：开头明确 reference 仅承接精确存储维护约束，并反向指定触发、语义恢复与交付由 SKILL.md 承接。

### `260718-separate-logical-archive-from-relations` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260718-separate-logical-archive-from-relations.md`。
- 采用方向原记录：`9871d7b71d6c`（路径同复核）。
- `9871d7b71d6c:scripts/decision-records/src/cli.ts`：archive 可在无 --by 时仅移出成员；有 --by 时以 successor.relations 计算缺失直接目标并拒绝不完整承接。
- `9871d7b71d6c:scripts/decision-records/tests/run.ts`：测试独立 archive 后计数，拒绝无直接关系的 --by，补直接替代关系后成功，并断言关系环被检查器拒绝。

### `260718-use-purpose-background-decision-structure` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260718-use-purpose-background-decision-structure.md`。
- 采用方向原记录：`72559e9e9de2`（路径同复核）。
- `72559e9e9de2:scripts/decision-records/src/decision-index.ts`：严格 schema 要求 schemaVersion: 2，且每个 current 条目必须有 path、title、purpose、background、decision。
- `72559e9e9de2:scripts/decision-records/tests/run.ts`：测试将 schemaVersion 改为 1 及缺失 purpose 的情形均断言为错误，验证 v2 投影与正文要求。

### `260719-model-verification-obligations-and-source-roles` — `aligned`

复核：`9cb979ef6555:docs/decisions/test-evidence-review-behavior/260719-model-verification-obligations-and-source-roles.md`。
- 采用方向原记录：`8618b0ccc377`（路径同复核）。
- `8618b0ccc377:scripts/test-evidence/src/evidence-validation.ts`：验证器按 active automated/review/exempt 分类，检查 main Code 一致、exempt 映射、角色类型、同文件 main/derived 冲突和未登记测试文件。
- `8618b0ccc377:scripts/test-evidence/tests/run.ts`：有效工作区断言 1 个 review、1 个 exempt、main/derived/exempt 映射及零未登记文件；fixture 同时覆盖 Scope、Risk、Reason、Review。

### `260719-organize-multi-branch-proofs-by-shared-base` — `aligned`

复核：`9cb979ef6555:docs/decisions/test-evidence-review-behavior/260719-organize-multi-branch-proofs-by-shared-base.md`。
- 采用方向原记录：`aa1bbb7bd1c0`（路径同复核）。
- `aa1bbb7bd1c0:skills/test-evidence-review/references/ledger-contract.md`：历史账本契约将 automated case 定义为共享基座或连续行为链路审计单元，并要求多分支使用 Proves 与 Mermaid 结构。
- `aa1bbb7bd1c0:scripts/test-evidence/tests/run.ts`：有效账本 fixture 用两个 Proves、共享 calculator fixture、分支节点和 subgraph leaf assertions，CLI 验证通过该 case 格式。

### `260719-own-project-aware-skill-lifecycle` — `aligned`

复核：`9cb979ef6555:docs/decisions/skill-maintainer-behavior/260719-own-project-aware-skill-lifecycle.md`。
- 采用方向原记录：`97d493e2243c`（路径同复核）。
- `97d493e2243c:skills/skill-maintainer/SKILL.md`：实际 skill 提供能力归属流程、五类模型、最小基线/环境集成、验证器使用和完成检查。
- `97d493e2243c:scripts/skill-validator/tests/run.ts`：历史测试对有效 portable skill、生成验证器成功、无效 name/description/资源目录/内外链接和空正文的失败诊断逐项断言。

### `260719-separate-test-value-from-ledger-validation` — `aligned`

复核：`9cb979ef6555:docs/decisions/test-evidence-review-behavior/260719-separate-test-value-from-ledger-validation.md`。
- 采用方向原记录：`c3b11405a004`（路径同复核）。
- `c3b11405a004:scripts/test-evidence/src/validation.ts`：验证器将 implemented/planned case、主要/辅助/豁免 marker、账本 Code、发现测试文件和 ignore/warn/error 未登记策略分开检查。
- `c3b11405a004:scripts/test-evidence/tests/run.ts`：有效 fixture 断言 case、primary/supporting/exempt 和多语言发现汇总；warning/error 未登记、planned marker 和无效 marker 都有失败断言。
- 后续变化／边界：至 9cb 仅将可消费结论的相邻 owner 从 code-review 改为 product-architecture-thinking；测试价值、账本与 CLI 的完整方向未变。

### `260720-auto-initialize-index-on-first-activation` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260720-auto-initialize-index-on-first-activation.md`。
- 采用方向原记录：`26b84ae19a14`（路径同复核）。
- `26b84ae19a14:scripts/decision-records/src/cli.ts`：canInitializeIndex 限制为目录可用、索引缺失且仅有索引缺失诊断；writeValidatedIndex 在新索引校验失败时 fs.rm 新文件。
- `26b84ae19a14:scripts/decision-records/tests/run.ts`：测试先让首激活因关系错误失败且确认索引不存在，再激活有效目标并断言“Initialized ... and activated”和恢复的原索引内容。

### `260720-complete-by-task-outcome` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records-skill/260720-complete-by-task-outcome.md`。
- 采用方向原记录：`e53bf1a9b3c6`（路径同复核）。
- `e53bf1a9b3c6:skills/decision-records/SKILL.md`：“确定任务出口”及三组“完成标准”实际区分恢复/审阅、候选、维护/迁移，并仅为维护/迁移要求严格 check。

### `260720-define-skills-by-self-contained-contracts` — `unaligned`

复核：`c36fbdaf3cd0:docs/decisions/skill-maintainer-behavior/260720-define-skills-by-self-contained-contracts.md`。
- `c36fbdaf3cd0:docs/decisions/decision-index.json`：建立该记录的同一提交中，JSON 的 current 未包含此 Markdown 路径；没有该判断进入当前集合或被核对建立的历史登记证据。
- `c36fbdaf3cd0:docs/decisions/skill-maintainer-behavior/260720-use-distribution-unit-boundaries.md`：同提交建立的记录以“判定无效”直接指向本记录，并明确允许同一 distribution unit 内成员显式点名、调用和依赖。
- `c36fbdaf3cd0:skills/skill-maintainer/SKILL.md`：实际契约把独立交付边界放在 distribution unit，并在“定义行为和依赖契约”允许单元内 skill 依赖；未落实每个分发 skill 都不假定其他 skill 的方向。
- 后续变化／边界：创建后至 9cb 的记录正文未改写；没有更早 active/aligned 登记，且建立提交本身即未将其加入 current，并用同提交后继“判定无效”。

### `260720-keep-problem-reframing-self-contained` — `aligned`

复核：`9cb979ef6555:docs/decisions/problem-reframing-behavior/260720-keep-problem-reframing-self-contained.md`。
- 采用方向原记录：`83d58245adf9`（路径同复核）。
- `83d58245adf9:skills/problem-reframing/SKILL.md`：历史 skill 的 description、判断对象和执行流程直接实现框架风险触发、恢复目标/前提/边界、最小框架选择和交回任务。

### `260720-return-query-results-with-warnings` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260720-return-query-results-with-warnings.md`。
- 采用方向原记录：`26b84ae19a14`（路径同复核）。
- `26b84ae19a14:scripts/decision-records/src/cli.ts`：查询路径将可恢复结果与诊断分离；写命令仍以 scan.errors 严格阻断，激活初始化也仅放行唯一的索引缺失错误。
- `26b84ae19a14:scripts/decision-records/tests/run.ts`：测试损坏正文时 list/trace 仍以 exit 0 输出 [invalid] 和 warning，索引无效时 list exit 1，索引漂移时查询返回结果并报告诊断。

### `260720-separate-editorial-edits-from-evolution` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260720-separate-editorial-edits-from-evolution.md`。
- 采用方向原记录：`26b84ae19a14`（路径同复核）。
- `26b84ae19a14:skills/decision-records/references/decision-record-rules.md`：“正文规则”和“编辑性修正”逐字落入固定契约：原地范围、需新记录的语义字段、sync-index 与 check 的后续动作均明确。

### `260720-separate-framing-from-engineering-landing` — `unaligned`

复核：`9cb979ef6555:docs/decisions/product-architecture-thinking-behavior/260720-separate-framing-from-engineering-landing.md`。
- 采用方向原记录：`dc4b7ab6d9ba`（路径同复核）。
- `dc4b7ab6d9ba:skills/`：同一历史 tree 中 `skills/product-architecture-thinking/` 已删除，只有新建的 `skills/product-architecture-judgment/SKILL.md`；采用方向指定的分发路径并未建立。
- 后续变化／边界：从创建到 9cb 该记录正文未改写；因此未出现将采用路径改为 product-architecture-judgment 的语义修正。

### `260720-separate-status-commands-from-relations` — `aligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260720-separate-status-commands-from-relations.md`。
- 采用方向原记录：`d78ac9f34a15`（路径同复核）。
- `2e1f68c4cf49:scripts/decision-records/src/cli-args.ts`：archive 子命令改为“Set active decisions to archived without changing related decisions”，并删除 --by option。
- `2e1f68c4cf49:scripts/decision-records/tests/run.ts`：测试先 archive 前序并断言仅状态变 archived，再单独 activate 后继并断言 active；queries.test.ts 还断言 archive --by 为 unknown option。

### `260720-use-configurable-decision-root` — `unaligned`

复核：`9cb979ef6555:docs/decisions/decision-records/260720-use-configurable-decision-root.md`。
- 采用方向原记录：`e53bf1a9b3c6`（路径同复核）。
- `e53bf1a9b3c6:scripts/decision-records/src/scan.ts`：建立该记录的同一 tree 中，scanDecisionRecords 对绝对 --decisions-dir 直接 path.resolve(configuredDecisionDirectory)，对相对路径也直接 path.resolve(workspaceRoot, configuredDecisionDirectory)，没有 containment 检查；`../` 或绝对工作区外目录均可成为根。
- 后续变化／边界：至 9cb 仅压缩摘要；完整正文仍要求“工作区内”，未放宽为任意绝对或逃逸相对路径。

### `260627-establish-decision-record-policy` — `aligned`

复核：`f3eb02e0ba63:docs/decisions/decision-records/260627-amended-establish-decision-record-policy.md`。
- `f3eb02e0ba63:docs/decisions/decision-records/260627-amended-establish-decision-record-policy.md`：完整正文将记录限为可回放的长期判断，明确影响面目录、两个 owner 与删除低价值记录。
- `f3eb02e0ba63:docs/decisions/decision-record-index.md`：索引实际按 decision-records、project-tooling、skill-references 三个影响面导航。
- `f3eb02e0ba63:docs/decisions/decision-record-rules.md`：规则实际承接门槛、影响面命名、文件和更新流程；与索引 owner 分离。
- 后续变化／边界：复核至归档前的后续正文：其将文件名和状态关系交给后继记录，但保留的高门槛、影响面和 owner 方向未出现反证。

### `260630-publish-skill-package-as-latest-release` — `aligned`

复核：`f3eb02e0ba63:docs/decisions/project-tooling/260630-active-publish-skill-package-as-latest-release.md`。
- `f3eb02e0ba63:docs/decisions/project-tooling/260630-active-publish-skill-package-as-latest-release.md`：历史 active 正文完整规定聚合 latest release、触发范围、assets 与 PR 非发布边界。
- `f3eb02e0ba63:.github/workflows/package-skills.yml`：package job 在三种触发下校验/打包/上传 dist/*.zip；publish job 有 main 及事件 guard、contents: write、skills-latest 和 gh release upload --clobber。
- `f3eb02e0ba63:docs/tooling.md`：CI 章节同时说明 artifact 职责和仅 main push/manual 发布 skills-latest。
- 后续变化／边界：后续正文记录 hash、版本化 release 和单仓库的修订关系；这些是后继演进，不否定该时点的完整 latest 实现。

### `260630-reorganize-prompt-optimize-rewrite-rules-as-pipeline` — `aligned`

复核：`3ad002427e86:docs/decisions/skill-references/2026-06-30-reorganize-rewrite-rules-as-pipeline.md`。
- `3ad002427e86:docs/decisions/skill-references/2026-06-30-reorganize-rewrite-rules-as-pipeline.md`：完整正文列出四个文件 owner 与八步采用方向。
- `3ad002427e86:skills/prompt-optimize/references/rewrite-rules.md`：实际有 1 至 8 的任务出口、骨架、审计、owner、规则、负向描述、表达、沉淀管线。
- `3ad002427e86:skills/prompt-optimize/references/workflows.md`：改写工作流只枚举同一八步顺序，而具体判断留在 rewrite-rules。
- 后续变化／边界：后续 260630 merge 记录将该拆分方案标为 superseded；这是其后采用方向变化，不是该历史实现缺失。

### `260630-track-decision-status-and-relations` — `aligned`

复核：`f3eb02e0ba63:docs/decisions/decision-records/260630-amended-track-decision-status-and-relations.md`。
- `f3eb02e0ba63:docs/decisions/decision-record-rules.md`：实际定义四种状态、文件名状态段、非 active 后继链接和保持影响面一级目录。
- `f3eb02e0ba63:docs/decisions/decision-record-index.md`：索引实际按状态展示并把关系解释留给决策正文。
- `f3eb02e0ba63:scripts/validate-decisions.ts`：validator 检查四种状态、文件名/正文一致以及 non-active 后继链接存在。
- 后续变化／边界：后续正文显示其日期前缀和正文最小结构被 260630 compact 修订；状态和关系主体仍与历史实现一致。

### `260630-use-compact-decision-records` — `aligned`

复核：`f3eb02e0ba63:docs/decisions/decision-records/260630-active-use-compact-decision-records.md`。
- `f3eb02e0ba63:docs/decisions/decision-records/260630-active-use-compact-decision-records.md`：完整 active 正文明确短日期、必需小节和两个可选小节。
- `f3eb02e0ba63:docs/decisions/decision-record-rules.md`：规则给出 YYMMDD-status 格式、最小/完整正文及可省略小节的条件。
- `f3eb02e0ba63:scripts/validate-decisions.ts`：validator 的 requiredSections 仅要求五个最小小节，并接受背景与过程缺席。

### `260701-compact-entry-and-archive-migration-copies` — `aligned`

复核：`64decf7b479d:docs/decisions/prompt-optimize-references/260701-active-compact-entry-and-archive-migration-copies.md`。
- `64decf7b479d:docs/decisions/prompt-optimize-references/260701-active-compact-entry-and-archive-migration-copies.md`：合并时仍可读的 active 正文完整规定八步入口和 archive 的非主动性质。
- `64decf7b479d:skills/prompt-optimize/SKILL.md`：入口有八个按需判断步骤，主动引用仅含 principles、agent-tasks 和整体审阅，未列 archive。
- `64decf7b479d:skills/prompt-optimize/references/archive/rewrite-rules.md`：文件头明确其为合并默认管线后的迁移保留副本且不再主动读取；workflows.md 具有同样说明。

### `260701-embed-self-update-script-in-skill-packages` — `aligned`

复核：`64decf7b479d:docs/decisions/project-tooling/260701-amended-embed-self-update-script-in-skill-packages.md`。
- `64decf7b479d:scripts/templates/update-skill.ts`：模板使用 fflate 解压远端 zip，包含 fingerprint、--check、交互确认、临时目录替换和路径边界保护。
- `64decf7b479d:scripts/sync-skill-updaters.ts`：同步器从统一模板生成 scripts/update-skill.cjs，并在 check 模式检测缺失或漂移。
- `64decf7b479d:skills/prompt-optimize/scripts/update-skill.cjs`：已提交产物含生成头、模板 URL、skill source URL，并内嵌该 skill 的更新配置。
- `64decf7b479d:package.json`：check 在历史版本中串联 sync-skill-updaters --check。

### `260701-gate-latest-release-by-skill-hash` — `aligned`

复核：`328bc9596924:docs/decisions/project-tooling/260701-amended-gate-latest-release-by-skill-hash.md`。
- `328bc9596924:scripts/lib/skill-package-hash.ts`：实现按已发现 skill 和排序后的文件路径、字节长度、字节内容写入 SHA-256。
- `328bc9596924:scripts/hash-skills.ts`：实现当前/记录 hash 比较、GitHub outputs 和 --check/--write。
- `328bc9596924:scripts/lib/project.ts`：skill discovery 与 collectSkillFiles 对目录条目排序；它是 hash-skills 复用的稳定输入枚举。
- `328bc9596924:.github/workflows/package-skills.yml`：workflow 从 github.event.before 读旧 hash，publish 只在 skill_hash_changed=true 时运行，并在发布后写回并提交 hash。
- 后续变化／边界：后续正文把 release 版本化并最终转为其他模型；该历史 revision 的 hash 门禁和写回路径可直接核对。

### `260710-use-cli-active-index-and-invalidated-archive` — `aligned`

复核：`be9323c99d29:docs/decisions/decision-records-skill/260710-active-use-cli-active-index-and-invalidated-archive.md`。
- `be9323c99d29:skills/decision-records/scripts/decision-records.mjs`：仅有 check/list/sync-index，list 默认 active、--write 仅允许 sync-index；scan 要求 invalidated 位于 archive/<impact-area> 且 archive 不含其他状态，没有 archive mutation 命令。
- `be9323c99d29:skills/decision-records/references/decision-record-rules.md`：契约将 active 索引、显式历史查询、保留记录和 invalidated 归档位置写为维护规则。
- 后续变化／边界：后续生命周期模型替换文件名状态体系；没有把此时已实现的命令边界作为后继实现证据。

### `260711-bound-history-with-direct-relations` — `aligned`

复核：`1e0fbb27be2a:docs/decisions/decision-records/260711-active-bound-history-with-direct-relations.md`。
- `1e0fbb27be2a:docs/decisions/decision-records/260711-active-bound-history-with-direct-relations.md`：完整 active 正文规定直接关系、独立结论、归并和不删除祖先。
- `1e0fbb27be2a:skills/decision-records/references/decision-record-rules.md`：定义四类直接关系、双向导航、归并终点及无关系时省略；维护事务要求完整结论、仅链接直接前序并同步索引。
- 后续变化／边界：后续 relation 表达改为 frontmatter；这里的完整 Markdown 关系方向在该历史 revision 已有明确规则实现。

### `260711-repair-noncanonical-decision-formats` — `aligned`

复核：`1e0fbb27be2a:docs/decisions/decision-records-skill/260711-active-repair-noncanonical-decision-formats.md`。
- `1e0fbb27be2a:docs/decisions/decision-records-skill/260711-active-repair-noncanonical-decision-formats.md`：完整 active 正文规定唯一目标格式、可自主确定的映射和只读报告边界。
- `1e0fbb27be2a:skills/decision-records/references/decision-record-rules.md`：“修复非标准格式”事务列出清点、语义映射、关系/链接恢复、索引同步和仅在改变含义时询问。
- `1e0fbb27be2a:skills/decision-records/SKILL.md`：历史 skill 的识别与维护流程将非标准输入收敛到固定契约，而不是维护兼容分支。
- 后续变化／边界：后续记录改写了确认授权规则；未发现它否定当时已写入 skill/reference 的唯一契约与只读边界。

### `260711-require-confirmed-decision-writes` — `aligned`

复核：`929c861d2965:docs/decisions/decision-records-skill/260711-active-require-confirmed-decision-writes.md`。
- `929c861d2965:docs/decisions/decision-records-skill/260711-active-require-confirmed-decision-writes.md`：完整 active 正文列出候选概览、确认复用、局部例外不写和非标准格式的显式修复边界。
- `929c861d2965:skills/decision-records/SKILL.md`：执行流程逐项实现只读恢复、明确记录确认、候选概览、确认前保持只读和确认后修复。
- `929c861d2965:scripts/decision-records/tests/run.ts`：测试在复制 contract 到项目决策根时断言 validator 报 root contains unsupported file，支持唯一 bundled contract 边界。
- 后续变化／边界：后续 active/archived body 的确认表述发生演进；本结论只针对 929 的完整 skill/reference 行为。

### `260711-separate-skill-script-source-and-generated-artifacts` — `aligned`

复核：`b38300ded226:docs/decisions/project-tooling/260711-active-separate-skill-script-source-and-generated-artifacts.md`。
- `b38300ded226:scripts/decision-records/build.ts`：构建器以 scripts/decision-records/src/cli.ts 生成 skills/decision-records/scripts/decision-records.mjs，check 仅比较、write 才更新。
- `b38300ded226:skills/decision-records/scripts/decision-records.mjs`：已提交产物头同时给出禁止直接编辑、仓库、源码 URL/path、skill 目录和 rebuild 命令。
- `b38300ded226:scripts/decision-records/tests/run.ts`：测试以生成 CLI 路径运行 Node 分发产物，并引用源码/生成物检查。

### `260711-use-bundled-contract-owner` — `aligned`

复核：`929c861d2965:docs/decisions/decision-records/260711-active-use-bundled-contract-owner.md`。
- `929c861d2965:skills/decision-records/SKILL.md`：Owner 与读取将 bundled rules 标为唯一固定契约，目标 docs/decisions 只存索引和实际决策。
- `929c861d2965:skills/decision-records/references/decision-record-rules.md`：reference 独立定义目录、状态、关系、正文、索引和维护事务，作为固定契约。
- `929c861d2965:skills/decision-records/scripts/decision-records.mjs`：扫描器的 requiredRootFiles 仅含 decision-record-index.md，根目录其他文件报 unsupported，直接实现不接受项目契约副本。
- 后续变化／边界：6cdf156 将索引从 Markdown 迁至 JSON，当前归档正文随之改写；这不改变 929 时唯一 bundled contract 的已实现方向。

### `260720-use-filtered-decision-queries` — `aligned`

复核：`2e1f68c4cf49:docs/decisions/decision-records/260720-use-filtered-decision-queries.md`。
- 采用方向原记录：`d78ac9f34a15`（路径同复核）。
- `2e1f68c4cf49:scripts/decision-records/src/cli.ts; scripts/decision-records/tests/queries.test.ts`：实现查询命令；测试分别断言默认 active、--status archived/all、show 元数据和带方向 trace。

### `260720-use-lifecycle-index-and-semantic-paths` — `aligned`

复核：`2e1f68c4cf49:docs/decisions/decision-records/260720-use-lifecycle-index-and-semantic-paths.md`。
- 采用方向原记录：`d78ac9f34a15`（路径同复核）。
- `2e1f68c4cf49:scripts/decision-records/src/decision-index.ts; scripts/decision-records/src/decision-path.ts; scripts/decision-records/tests/queries.test.ts`：代码生成全记录索引并使用语义路径；查询测试覆盖 active/archived/all 和 topic 路径筛选。

### `260720-use-product-and-architecture-lenses` — `aligned`

复核：`f5754c8e9798:docs/decisions/product-architecture-thinking-behavior/260720-use-product-and-architecture-lenses.md`。
- `f5754c8e9798:skills/product-architecture-thinking/SKILL.md`：同次提交新增独立 skill，入口逐段落实产品、架构、技术动作和任务出口；同时删除旧 code-review skill，旧入口见 `f5754c8e9798^:skills/code-review/SKILL.md`。

### `260721-separate-test-entry-collection-from-ledger` — `aligned`

复核：`143adb7a4363:docs/decisions/test-evidence-review-behavior/260721-separate-test-entry-collection-from-ledger.md`。
- `143adb7a4363:scripts/test-evidence/src/regex-collector.ts; scripts/test-evidence/src/ledger-cli.ts; scripts/test-evidence/src/schemas.ts; scripts/test-evidence/tests/run.ts`：同次实现独立 collector、仅接收 inventory 的 ledger 和 Schema；测试把外部 AST inventory 传给 ledger，并断言 schema-invalid 和 CLI inventory 路径。

### `append-self-contained-investigation-reports` — `aligned`

复核：`59181282d171:docs/decisions/investigation-report-behavior/append-self-contained-investigation-reports.md`。
- `59181282d171:scripts/investigation-report/src/markdown.ts; scripts/investigation-report/src/validation.ts; scripts/investigation-report/tests/run.ts`：同次重写报告生成/校验；测试覆盖三项核心章节的存在、非空、唯一和顺序。

### `converge-records-before-stable-baseline` — `aligned`

复核：`11a21df71692:docs/decisions/decision-records/converge-records-before-stable-baseline.md`。
- `11a21df71692:skills/decision-records/references/decision-record-rules.md; skills/decision-records/SKILL.md`：同次把稳定基线/依赖条件和候选原地收敛规则写入行为入口及权威规则 owner。

### `define-decision-alignment-semantics` — `aligned`

复核：`3a124c45cd18:docs/decisions/decision-records/define-decision-alignment-semantics.md`。
- 采用方向原记录：`9cb979ef6555`（路径同复核）。
- `3a124c45cd18:scripts/decision-records/src/decision-metadata.ts; skills/decision-records/references/decision-record-rules.md; scripts/decision-records/tests/run.ts`：同次实现 alignment 元数据和生命周期校验；测试拒绝 active/null 并验证 unaligned 不能回退及索引投影。

### `derive-pending-from-head-path` — `aligned`

复核：`816349a7fb23:docs/decisions/decision-records/derive-pending-from-head-path.md`。
- `816349a7fb23:scripts/decision-records/src/head-decision-paths.ts; scripts/decision-records/src/cli.ts; scripts/decision-records/tests/head-presence.test.ts`：同次实现 HEAD 路径收集和查询/写命令的 pending 标记；专项测试覆盖路径存在、错误与首次提交边界。

### `establish-decisions-with-atomic-evolution` — `aligned`

复核：`ddaae930689f:docs/decisions/decision-records/establish-decisions-with-atomic-evolution.md`。
- `ddaae930689f:tools/decision-records/src/cli.ts; tools/decision-records/tests/lifecycle-establishment.test.ts`：同次实现生命周期和演进事务；专项测试验证建立、关系和原子失败/恢复约束。

### `express-decision-alignment-state` — `aligned`

复核：`3a124c45cd18:docs/decisions/decision-records/express-decision-alignment-state.md`。
- 采用方向原记录：`d57fb4c44b4b`（路径同复核）。
- `3a124c45cd18:scripts/decision-records/src/decision-metadata.ts; scripts/decision-records/tests/run.ts`：实现 alignment 字段和索引投影；测试验证 active 记录不可为 null、归档和激活状态的投影。

### `index-independent-proof-cases-from-current-catalog` — `aligned`

复核：`efd1a3fadbac:docs/decisions/test-evidence-review/index-independent-proof-cases-from-current-catalog.md`。
- `efd1a3fadbac:tools/verification-evidence/src/query.ts; tools/verification-evidence/tests/run.ts`：query 在索引异常时明确用当前 catalog 的内存投影且不写入；测试覆盖 Contract/Proves 搜索、show 和 stale-index 降级查询。
- 后续变化／边界：记录的首个可见版本就是此实现提交且为 archived/null；该结论仅据同一 revision 的完整正文、代码和测试证明历史方向已经落地，不以归档字段本身推断。

### `package-index-json-schema` — `aligned`

复核：`c666e5ae621f:docs/decisions/decision-records/package-index-json-schema.md`。
- `c666e5ae621f:scripts/decision-records/src/decision-index-json-schema.ts; scripts/decision-records/build.ts; scripts/decision-records/tests/generated-artifacts.test.ts`：同次新增 schema 生成器并写入 skill references；测试将分发 JSON 与源码对象比较并断言必填字段。

### `query-ledger-with-structured-inspection` — `aligned`

复核：`143adb7a4363:docs/decisions/test-evidence-review-behavior/query-ledger-with-structured-inspection.md`。
- `143adb7a4363:scripts/test-evidence/src/inspection.ts; scripts/test-evidence/src/ledger-cli.ts; scripts/test-evidence/tests/run.ts`：同次实现 inspection 视图和 ledger list/show；测试断言 inspection 的 case/entry 视图、list/show 输出和 incomplete/schemaVersion。

### `support-degraded-decision-maintenance` — `aligned`

复核：`c666e5ae621f:docs/decisions/decision-records/support-degraded-decision-maintenance.md`。
- `c666e5ae621f:skills/decision-records/references/maintenance-recovery.md; scripts/decision-records/build.ts; scripts/decision-records/tests/generated-artifacts.test.ts`：同次提供分故障恢复路径及构建分发资源；生成产物测试验证恢复所依赖的 CLI、声明、Schema 和 source map。

### `use-alignment-aware-decision-commands` — `aligned`

复核：`3a124c45cd18:docs/decisions/decision-records/use-alignment-aware-decision-commands.md`。
- 采用方向原记录：`9cb979ef6555`（路径同复核）。
- `3a124c45cd18:scripts/decision-records/src/cli.ts; scripts/decision-records/src/decision-transaction.ts; scripts/decision-records/tests/run.ts`：实现对齐感知 activate/list/事务；测试覆盖显式 alignment、拒绝 rollback、归档/激活和索引投影。

### `use-error-recovery-reference` — `aligned`

复核：`2e1f68c4cf49:docs/decisions/decision-records/use-error-recovery-reference.md`。
- `2e1f68c4cf49:skills/decision-records/references/maintenance-recovery.md; scripts/decision-records/src/cli.ts`：同次新增可执行的恢复手册，覆盖冷启动、索引重建、缺失成员和运行时不可用，并由 CLI 的 check/sync-index 路径承接恢复出口。

### `use-report-oriented-investigation-rounds` — `aligned`

复核：`c53b984f31d1:docs/decisions/investigation-report-behavior/use-report-oriented-investigation-rounds.md`。
- `c53b984f31d1:skills/investigation-report/SKILL.md; scripts/investigation-report/src/validation.ts; scripts/investigation-report/tests/run.ts`：同次新增 skill、报告校验器和完整测试；测试构造并校验调查信息、调查段及时间/结构约束。
- 后续变化／边界：其后 append-self-contained-investigation-reports 以显式替代关系演进；按单向历史语义，该后继不抹除 c53 已实现并验证的对齐事实。

### `use-second-precision-lifecycle-index` — `aligned`

复核：`2e1f68c4cf49:docs/decisions/decision-records/use-second-precision-lifecycle-index.md`。
- `2e1f68c4cf49:scripts/decision-records/src/decision-index.ts; scripts/decision-records/src/record.ts; scripts/decision-records/tests/queries.test.ts`：同次实现 records 生命周期投影和 createdAt 处理；测试读写活动/归档成员、全时间输出和索引校验。

### `use-topic-filtered-decision-queries` — `aligned`

复核：`2e1f68c4cf49:docs/decisions/decision-records/use-topic-filtered-decision-queries.md`。
- `2e1f68c4cf49:scripts/decision-records/src/cli-args.ts; scripts/decision-records/src/cli.ts; scripts/decision-records/tests/queries.test.ts`：同次实现 topic/status/full-time 参数；测试断言 topic+all、合法空 topic、默认 active 和错误旧参数。

### `260630-name-decision-root-docs-by-owner` — `aligned`

复核：`f3eb02e0ba63:docs/decisions/decision-records/260630-active-name-decision-root-docs-by-owner.md`。
- `f3eb02e0ba63:docs/decisions/decision-records/260630-active-name-decision-root-docs-by-owner.md`：该完整 active 正文与 fd256838 同路径 blob 完全相同（blob 8628d3de…）；它明确采用两个 owner 和验证非 active 状态来源链接。
- `f3eb02e0ba63:docs/decisions/decision-record-index.md`：实际文件声明自己只承接影响面、状态速查和决策链接，并指向规则 owner。
- `f3eb02e0ba63:docs/decisions/decision-record-rules.md`：实际文件承接门槛、命名、状态关系、正文结构与更新流程，排除索引职责。
- `f3eb02e0ba63:scripts/validate-decisions.ts`：同一 tree 的 validator 定义四种状态，并校验 non-active 状态来源是现有 impact-area 决策路径。
- 后续变化／边界：fd256838 的决策 Markdown 是同一 blob 8628d3de…，但其 tree 尚无 validator；以 f3eb02e 的同 blob、同路径完整 tree 作为可证明完成 revision。后续归档正文没有新增未实现的完整方向。

### `260630-merge-prompt-optimize-core-flow-into-entry` — `aligned`

复核：`4acffff64c9f:docs/decisions/skill-references/2026-06-30-merge-core-flow-into-entry.md`。
- `4acffff64c9f:docs/decisions/skill-references/2026-06-30-merge-core-flow-into-entry.md`：原始决策与实现同提交形成；验证段逐项确认入口已吸收主干、运行路径不再主动引用两份副本、副本已有迁移说明，并记录 pnpm run check 验证。
- `4acffff64c9f:skills/prompt-optimize/SKILL.md`：子模块化前的完整同仓树可直接读取：入口包含目标、两项主动引用、九步主执行流程、模式分流、冲突、交付与完成检查，完整承接决策列出的默认路径。
- `4acffff64c9f:skills/prompt-optimize/references/workflows.md`：文件首段明确它是合并默认工作流后的迁移保留副本、当前不再作为主动读取入口、仅供回溯旧结构。
- `4acffff64c9f:skills/prompt-optimize/references/rewrite-rules.md`：文件首段以相同方式标记改写管线为迁移保留副本；正文仍完整保留旧八步规则，满足保留而非删除的方向。
- 后续变化／边界：22b9c570364c 后继将该记录改为 amended，只改变入口细则展开程度和副本位置；它明确保留 SKILL.md 为默认路径 owner。313701a1f738 随后把副本移入 archive。后期修订不撤销 4acffff 时已经完整实现并核对的单向历史基线。

### `260710-use-explicit-portable-decision-memory` — `aligned`

复核：`be9323c99d29:docs/decisions/decision-records-skill/260710-amended-use-explicit-portable-decision-memory.md`。
- `be9323c99d29:docs/decisions/decision-records-skill/260710-amended-use-explicit-portable-decision-memory.md`：首次提交的旧记录虽已 amended，但完整保留原方向与验证：通用 skill、固定规则 reference、无依赖只读 validate-decisions.mjs，并明确记载校验器已通过本仓库和归档中的另一套真实决策目录。
- `be9323c99d29:docs/decisions/decision-records-skill/260710-active-use-cli-active-index-and-invalidated-archive.md`：同次后继的决策过程明确回放时间顺序：初版脚本只提供只读结构检查，之后用户才要求 CLI、索引同步和归档；它正面证明只读阶段存在，而不是从当前可写 CLI 反推。
- `d15ee9ab6e41:scripts/validate-decisions.ts`：直接父树的命令入口只调用 validateDecisionRecords 并输出诊断，没有写入命令。
- `d15ee9ab6e41:scripts/validators/decision-records.ts`：直接父树的校验实现只读取索引与决策 Markdown 并返回错误，提供原方向所复用的第一套真实项目机制。
- `be9323c99d29:skills/decision-records/references/archive/wsl/docs/decisions/decision-record-rules.md`：提交内保留第二个真实项目的公开 Markdown 契约、索引与决策样本，佐证固定协议跨项目使用及目标项目拥有数据的边界。
- 后续变化／边界：be9323 的后继已明确把脚本只读、全状态索引和 invalidated 位置标为被修订部分，同时明确显式可移植记忆、目标项目 data owner 与 skill 语义判断仍有效。可写 CLI 是后续偏离，不撤销记录所明载且已验证的初版完整方向。

### `preserve-comparable-investigation-inputs` — `unaligned`

复核：`8be2bf136c47:docs/decisions/investigation-report-behavior/preserve-comparable-investigation-inputs.md`。
- `8be2bf136c47:scripts/investigation-report/src/markdown.ts`：同一形成树第 34 行仍将 requiredReportSectionTitles 固定为旧三段“背景、起因、调查结果”，与新决策缺少调查目标且语义不同。
- `8be2bf136c47:skills/investigation-report/references/investigation-report-contract.md`：同一树的分发契约第 103 行仍机械要求旧三段，且正文多处把起因作为固定核心；因此不仅实现未更新，公开行为 owner 也未采用该方向。
- `3013fc3013dc:docs/decisions/investigation-report-behavior/use-fixed-investigation-record-core.md`：8be2bf 的唯一直接子提交立即以实质不同的四段方向修订原记录。
- `3013fc3013dc:scripts/investigation-report/src/markdown.ts`：同一后继提交把检查器直接改为“形成时背景、调查目的、调查范围与依据、调查结果与边界”；此前没有中间提交形成原四段对齐树。
- 后续变化／边界：3013fc 及后续正文一直保留新四段方向；原方向在其 active 的唯一已提交树中只存在于计划记录，代码与契约仍是旧三段，下一提交即被不同方向修订。这里的 unaligned 由同一历史树的正面差异与无中间提交共同支持，不是由“未找到实现”默认推断。

## 本地合理推断（4 条）

前三项中三个子仓库的指针同步是间接证据，不等于其文件或运行结果可读；最后一项不排除未提交实现。详见主报告的四项缺口。

### `260701-add-submodule-release-workflows` — `aligned`

复核：`328bc9596924:docs/decisions/project-tooling/260701-amended-add-submodule-release-workflows.md`。
- `328bc9596924:docs/decisions/project-tooling/260701-amended-add-submodule-release-workflows.md`：记录声明三个 submodule 均有 publish-skill-package.yml 与 skill-package.hash，并称发布入口由 review 和 GitHub Actions 运行结果确认；但这只是历史验证声明，本地主仓库不能重读所指文件或运行结果。
- `328bc9596924:docs/tooling.md`：主仓库文档描述子仓库用 HEAD:skill 计算 hash、独立打包与发布、且不安装主仓库工具链；它证明规则已记录，不能替代三个子仓库的实际配置。
- 同一提交中 `git-commit-organizer`、`openspec-skills`、`prompt-optimize` 三个 gitlink 同步；主仓库缺少这些子仓库对象，不能重读内部文件。
- 推断边界：用户允许按本地可复核材料作合理推断；三个子仓库的 publish workflow、hash 文件和运行结果均不能重读，gitlink 只证明指针同步。因此 `aligned` 是本次历史对齐推断，不表述为原始子仓库实现已验证。

### `260701-publish-versioned-skill-releases` — `aligned`

复核：`5c1f63682616:docs/decisions/project-tooling/260701-active-publish-versioned-skill-releases.md`。
- `5c1f63682616:.github/workflows/package-skills.yml`：主仓库可读 workflow 实现 skills-<hash12> 版本化 release、Latest 标记与 skills-latest 兼容入口，证明聚合发布部分。
- `5c1f63682616:docs/decisions/project-tooling/260701-active-publish-versioned-skill-releases.md`：决策验证段声明三个 submodule 的 publish workflow 同样创建 <repo-name>-<hash12> 并维护 latest；提交说明也称指针同步到支持该功能的 workflow commit，但二者都不能展示实际 YAML。
- 同一提交中 `git-commit-organizer`、`openspec-skills`、`prompt-optimize` 三个 gitlink 同步；主仓库缺少这些子仓库对象，不能重读内部文件。
- 推断边界：用户允许按本地可复核材料作合理推断；主仓库聚合 workflow 可读，但三个子仓库的实际 release YAML 与运行结果不能重读，gitlink 只证明指针同步。因此 `aligned` 是本次历史对齐推断，不表述为原始子仓库发布实现已验证。

### `260701-update-package-hash-with-git-hooks` — `aligned`

复核：`34b5c5e75eb8:docs/decisions/project-tooling/260701-active-update-package-hash-with-git-hooks.md`。
- `34b5c5e75eb8:.githooks/pre-commit`：主仓库 hook 可直接验证：拒绝脏子模块或未暂存指针，运行 hash-skills --write 并 git add 根 skill-package.hash。
- `34b5c5e75eb8:.github/workflows/package-skills.yml`：主仓库 CI 改为 --check --github-output 校验并按前一提交 hash 门控发布，不再包含 Actions 写回 hash 的 job。
- `34b5c5e75eb8:scripts/setup-git-hooks.ts`：安装器为根仓库以及实际存在 pre-commit 的子仓库设置 core.hooksPath；它不能证明三个子仓库文件当时的具体内容。
- 同一提交中 `git-commit-organizer`、`openspec-skills`、`prompt-optimize` 三个 gitlink 同步；主仓库缺少这些子仓库对象，不能重读内部文件。
- 推断边界：用户允许按本地可复核材料作合理推断；根 hook/CI 可读，但三个子仓库的 hook、hash 与 workflow 不能重读，gitlink 只证明指针同步。因此 `aligned` 是本次历史对齐推断，不表述为原始子仓库实现已验证。

### `mask-non-code-test-syntax` — `unaligned`

复核：`143adb7a4363:docs/decisions/test-evidence-review-behavior/mask-non-code-test-syntax.md`。
- `c666e5ae621f:scripts/test-evidence/src/discovery.ts`：直接父树仍直接以 text.matchAll(pattern.expression) 扫描，没有七语言等长屏蔽实现。
- `143adb7a4363:docs/decisions/decision-index.json`：索引保存原方向 createdAt 为 2026-07-21T01:52:14Z；首个可读 Git 提交时间为 2026-07-21T04:02:45Z。创建后同日即以已归档原方向和完整替代实现共同进入 Git。
- `143adb7a4363:docs/decisions/test-evidence-review-behavior/260721-separate-test-entry-collection-from-ledger.md`：首个可读树已替代原方向，并同次落地不猜测非代码位置的独立 collector 架构；原方向要求的七语言屏蔽和表驱动验证未在该树出现。
- 推断边界：用户允许按本地可复核材料作合理推断；历史原始实现无法完整重读。直接父树缺少七语言屏蔽并不能排除缺失的、未提交快照曾完整实现并验证该方向；因此 `unaligned` 是本次历史对齐推断，不把理论反例写成观察到的失败，也不主张从未有原型、局部尝试或未提交开发。
- 结合直接父树、短时序内的整体替代和原方向的七语言/表驱动完整义务，本地重建结论为未形成完整已核对的对齐基线，因此恢复为 `unaligned`。
