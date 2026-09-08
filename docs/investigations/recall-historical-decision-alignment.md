---
title: "历史决策对齐状态召回与来源修复"
id: "260908-recall-historical-decision-alignment"
formedAt: "2026-09-08T10:26:59Z"
question: "已归档且 alignment 为 null 的历史决策能否按逐条历史证据恢复最后对齐状态，并留下可独立复核的完整结果与推断边界？"
tags:
  - "decision-records"
relations: []
---

## 形成时背景

本轮以 Git 基线 `87c39c9541089cb33b027ba771da9f47c5bc6815` 为准，发现 92 条已归档决策的 `alignment` 为 `null`。历史归档会清空该字段，或更早记录从未保存字段；因此 `null` 本身不能推断最后对齐状态。

逐条历史召回与独立主审已批准并原位恢复全部 92 条：87 条为 `aligned`，5 条为 `unaligned`。每个目标仍为 `status: archived`；恢复的是历史对齐字段，而不是新的对齐事件，也不评价这些方向今天是否仍适用。

本 Change 获准的一次性来源修复仅在 archived/null 原位恢复审计通过的值：不重新激活记录，也不改变正文、状态、ID、路径、形成时间、tags 或关系。

## 调查目的

为 92 个恢复对象保留可独立复核的历史身份、完整采用方向、区分性依据、后续正文核对、修复前原始字节 SHA-256 与局限。读者应能仅凭本报告和 Git 中的 `revision:path` 重新检查历史结论，而不依赖临时召回目录。

本轮不以“未找到证据”、后继状态或当前测试替代相应历史时点的对齐判断。`inferred` 只在用户授权的本地合理推断范围内使用，不能被写成对原始实现的验证。

## 调查范围与依据

### 范围、来源与方法

- 集合：冻结基线中的 92 个 archived/null 对象。每条的“原始对象”均给出基线 archive 路径和修复前完整 Markdown 的 SHA-256；该哈希用于核对该条目的原始字节，不是修复后文件的哈希。
- `recorded`（31 条，均为 `aligned`）：以直接历史 frontmatter 已记录的 active/aligned 为最后已核对值，并核对它在同一身份归档时变为 archived/null。它证明的是历史已记录的对齐值，**不等于本轮独立验证当时实现**。
- `semantic`（57 条：54 条 `aligned`、3 条 `unaligned`）：在列明的同一历史 tree 中同时复核完整决策和实现、配置、规范或验证材料。每项保留支撑完整采用方向的区分性 `revision:path` 证据，不能由当前工作树或仅有采用声明替代。
- `inferred`（4 条：3 条 `aligned`、1 条 `unaligned`）：用户允许基于本地可得材料作合理推断；历史仓库或原始实现已删除、不可读或不能完整重读时，推断**不得表述为已验证原始实现**。各条另列具体证据与这一不确定性。

### 共同审查与写入规则

- 每条只在独立主审批准后进入本报告的最终值；下列逐项标题中的 alignment 就是该批准结果。为避免机械重复，不在每项重述相同的主审句。
- `recorded` 项的共同转换证据为：所列历史前版记录 active/aligned，归档提交将同一身份写为 archived/null；基线版本仍为 archived/null。条目中仅保留能区分对象的历史定位和后续正文核对。
- 所有 92 条写入前逐文件确认字节哈希等于基线、frontmatter 为 `status: archived` 与 `alignment: null`；写入后将 alignment 行归一为 `null` 再逐字节比较，证明其余字节未变。全部保留 `status: archived`，只恢复所列 alignment。
- 过程例外：一次 writer 在未带 `--select` 时执行 `sync-index`，实际全量重建了当时索引。随后逐批 selected 操作，以及最终全量来源字节与索引不变量，共同证明没有接纳额外来源；因此不得将过程描述为“始终只做 selected 同步”。
- 每批最多 10 条：先运行严格决策检查；索引陈旧时以同一完整 ID 做 selected `sync-index` 只读诊断（退出码 1、`outcome: no-change`），再以同一选择 `--write` 发布投影，随后严格检查并复查 selected 项为当前。

### 读法

逐项条目按方法分组。`历史核对`给出主审判断完整采用方向的主要时点；`区分性依据`保留该对象特有的可核对材料；`后续正文核对与局限`只排除同一身份在归档前的实质方向变化，不能单独证明 alignment。

## 调查结果与边界

### 已实际恢复的 92 条

| 方法 | `aligned` | `unaligned` | 合计 |
| --- | ---: | ---: | ---: |
| `recorded` | 31 | 0 | 31 |
| `semantic` | 54 | 3 | 57 |
| `inferred` | 3 | 1 | 4 |
| **合计** | **87** | **5** | **92** |

以下每项均已原位写入标题中的 alignment，并已按上节规则同步索引投影。

### `recorded`（31 条）

#### `260702-use-monorepo-skills-directory` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260702-use-monorepo-skills-directory.md`；修复前 SHA-256：`8dc292883ad4f48df4f14ce326bc9609deaf05bf8ee481301bbd94367593b976`。
- 历史核对：`e4f35740be7fedfb09189b34b44f6c572a83942e^:docs/decisions/project-tooling/260702-use-monorepo-skills-directory.md`。
- 完整采用方向：用 `skills/<skill-name>/` 直接承接所有实际可打包 skill, 每个一级目录必须包含 `SKILL.md`。
- 区分性依据：
  - `e4f35740be7fedfb09189b34b44f6c572a83942e^:docs/decisions/project-tooling/260702-use-monorepo-skills-directory.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 4 个身份快照均为 archived/null，未重新激活。

#### `260703-follow-latest-release-for-skill-updater` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260703-follow-latest-release-for-skill-updater.md`；修复前 SHA-256：`136c41eeb5effe0a8f0ab477cf979a5990feebf931d2474ce9915876ea07e289`。
- 历史核对：`e4f35740be7fedfb09189b34b44f6c572a83942e^:docs/decisions/project-tooling/260703-follow-latest-release-for-skill-updater.md`。
- 完整采用方向：skill updater 默认读取主仓库 latest release，并以正式 package lock 和 skill zip 作为远端更新输入。
- 区分性依据：
  - `e4f35740be7fedfb09189b34b44f6c572a83942e^:docs/decisions/project-tooling/260703-follow-latest-release-for-skill-updater.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 3 个身份快照均为 archived/null，未重新激活。

#### `260703-use-per-skill-hash-lock-for-updater` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260703-use-per-skill-hash-lock-for-updater.md`；修复前 SHA-256：`3d93c2eb3d283dd7898a58abfe9f2419a873341164b9cd4d7c9d2c256741ce89`。
- 历史核对：`e4f35740be7fedfb09189b34b44f6c572a83942e^:docs/decisions/project-tooling/260703-use-per-skill-hash-lock-for-updater.md`。
- 完整采用方向：根目录只保留 `skill-package-lock.json`，记录聚合 hash 和每个 skill 的独立包内容 hash。
- 区分性依据：
  - `e4f35740be7fedfb09189b34b44f6c572a83942e^:docs/decisions/project-tooling/260703-use-per-skill-hash-lock-for-updater.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 3 个身份快照均为 archived/null，未重新激活。

#### `260720-expose-importable-skill-modules` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260720-expose-importable-skill-modules.md`；修复前 SHA-256：`f3a77bc304dfd253285428934692b9b84f3370ee7ea4ec48f5f76f276fb8e11f`。
- 历史核对：`f7b64b007487b5016400883a54bc631a227a2282^:docs/decisions/project-tooling/260720-expose-importable-skill-modules.md`。
- 完整采用方向：从同一 TypeScript 源生成 import-safe 的自包含 MJS、声明和 source map；主模块判断负责兼容 CLI。
- 区分性依据：
  - `f7b64b007487b5016400883a54bc631a227a2282^:docs/decisions/project-tooling/260720-expose-importable-skill-modules.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 3 个身份快照均为 archived/null，未重新激活。

#### `260720-focus-entry-on-behavior-routing` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260720-focus-entry-on-behavior-routing.md`；修复前 SHA-256：`3a3e37f91f02c685e0d5b4555f50114890eff1d41a65d9987de817e14d14e42c`。
- 历史核对：`ddaae930689ff408f1453802e6c3d2a75710d3fe^:docs/decisions/decision-records/260720-focus-entry-on-behavior-routing.md`。
- 完整采用方向："`SKILL.md` 只承接内容 owner、主动读取、任务出口、恢复、候选、命令选择和分出口验收；目录、字段、关系、维护事务与 CLI 精确语义继续只由固定契约完整承接，入口在精确维护前加载该契约。"
- 区分性依据：
  - `ddaae930689ff408f1453802e6c3d2a75710d3fe^:docs/decisions/decision-records/260720-focus-entry-on-behavior-routing.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `260720-map-test-entries-and-trigger-scoped-reviews` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260720-map-test-entries-and-trigger-scoped-reviews.md`；修复前 SHA-256：`1ead4255d01fec5526dfae0e7581d0f419a06f631d8ba56cb5792787276630d8`。
- 历史核对：`ea0be0edecbee561ef06312c10de2cd8f8c59a12^:docs/decisions/test-evidence-review/260720-map-test-entries-and-trigger-scoped-reviews.md`。
- 完整采用方向：case 使用固定标题和 `Contract:`；源码角色逐测试入口映射；Scope 用严格 glob 与 Git 路径校验，并按变化和 CR 基线触发 review。
- 区分性依据：
  - `ea0be0edecbee561ef06312c10de2cd8f8c59a12^:docs/decisions/test-evidence-review/260720-map-test-entries-and-trigger-scoped-reviews.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `260720-orchestrate-checks-with-conservative-concurrency` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260720-orchestrate-checks-with-conservative-concurrency.md`；修复前 SHA-256：`9326b8948eea8657ee218923381f17d10660e83b0d5f3d1efd75afcb728ddf53`。
- 历史核对：`6aa9e1e7febb389f136b659d10664001ff007ab0^:docs/decisions/project-tooling/260720-orchestrate-checks-with-conservative-concurrency.md`。
- 完整采用方向：由 `scripts/check.ts` 统一编排完整检查，默认最多并发两个顶层任务并允许显式覆盖；失败后停止领取新任务、等待已启动任务，且仅在全部前置检查通过后打包。
- 区分性依据：
  - `6aa9e1e7febb389f136b659d10664001ff007ab0^:docs/decisions/project-tooling/260720-orchestrate-checks-with-conservative-concurrency.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 3 个身份快照均为 archived/null，未重新激活。

#### `260720-organize-proofs-by-shared-execution-chain` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260720-organize-proofs-by-shared-execution-chain.md`；修复前 SHA-256：`f1b947a5a02aa7cc22e8cfa43f26d5ea1694d98dfc1e77ebed36cc0b43de5bca`。
- 历史核对：`efd1a3fadbac34b39034ec6aa255cd5d0a73246c^:docs/decisions/test-evidence-review/260720-organize-proofs-by-shared-execution-chain.md`。
- 完整采用方向：automated case 按共同契约、共享基座或连续链路组织；`Proves:` 可写分支或线性检查点，Mermaid 按需表达，仅独立契约才拆分。
- 区分性依据：
  - `efd1a3fadbac34b39034ec6aa255cd5d0a73246c^:docs/decisions/test-evidence-review/260720-organize-proofs-by-shared-execution-chain.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `260720-use-prebuilt-git-test-fixtures` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/260720-use-prebuilt-git-test-fixtures.md`；修复前 SHA-256：`4dce1b54afe0fdb760c7814d0d8228ea272fcfd7dcdd3e560c78785437257101`。
- 历史核对：`f7b64b007487b5016400883a54bc631a227a2282^:docs/decisions/project-tooling/260720-use-prebuilt-git-test-fixtures.md`。
- 完整采用方向：使用多个预构建的逻辑 Git fixture 承接稳定历史，按场景物化隔离工作区；纯逻辑和可导入 CLI 测试在 Bun 进程内运行，只保留最小真实 Git 与 Node smoke。
- 区分性依据：
  - `f7b64b007487b5016400883a54bc631a227a2282^:docs/decisions/project-tooling/260720-use-prebuilt-git-test-fixtures.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 3 个身份快照均为 archived/null，未重新激活。

#### `allow-sequential-activation-of-prewritten-candidates` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/allow-sequential-activation-of-prewritten-candidates.md`；修复前 SHA-256：`995d32a2edb87005ef9cc4559ffb006ef0c1b3dac95876bc65b9548a19db50e2`。
- 历史核对：`8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/allow-sequential-activation-of-prewritten-candidates.md`。
- 完整采用方向：识别未进入 HEAD 的完整未激活候选；作用域维护可在逐条提醒后继续，索引排除候选，严格 check 继续阻断遗漏。
- 区分性依据：
  - `8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/allow-sequential-activation-of-prewritten-candidates.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `catalog-minimal-native-test-entries` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/catalog-minimal-native-test-entries.md`；修复前 SHA-256：`ce37add3f3e901e72fd4f57d2649f66147ac29709be68a2252035cdca45f73d9`。
- 历史核对：`f77bb607547bbe0692a22ad5c7fb7ed3811a3154^:docs/decisions/test-evidence-review/catalog-minimal-native-test-entries.md`。
- 完整采用方向：test-evidence-review 只登记最小原生测试入口，目录与索引保持显式维护和快速查询，不接入工程校验、marker、采集或自动注册。
- 区分性依据：
  - `f77bb607547bbe0692a22ad5c7fb7ed3811a3154^:docs/decisions/test-evidence-review/catalog-minimal-native-test-entries.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `complete-current-decision-work-by-task-outcome` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/complete-current-decision-work-by-task-outcome.md`；修复前 SHA-256：`1d3b393c1723b34ee89c2918a75738a35be09ef32bfd67164b0c7c0ee003e676`。
- 历史核对：`8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records-skill/complete-current-decision-work-by-task-outcome.md`。
- 完整采用方向：按恢复或审阅、候选和维护三类出口验收；warning 限定查询结论，严格 check 作为维护写入的最终门禁。
- 区分性依据：
  - `8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records-skill/complete-current-decision-work-by-task-outcome.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `derive-establishment-from-markdown-lifecycle` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/derive-establishment-from-markdown-lifecycle.md`；修复前 SHA-256：`439f72c6f00eea45663f226e2de5194bfacd994511946212bb1370d4ef900c86`。
- 历史核对：`ddaae930689ff408f1453802e6c3d2a75710d3fe^:docs/decisions/decision-records/derive-establishment-from-markdown-lifecycle.md`。
- 完整采用方向：createdAt 为空的完整新记录是候选；合法非空 createdAt Markdown 是全部已建立成员，索引只从它们完整派生。
- 区分性依据：
  - `ddaae930689ff408f1453802e6c3d2a75710d3fe^:docs/decisions/decision-records/derive-establishment-from-markdown-lifecycle.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `express-alignment-as-field-relation` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/express-alignment-as-field-relation.md`；修复前 SHA-256：`7dd324420f3741d7c44422fa095cace55a2858221c395b3e00bbe92fa8d1860e`。
- 历史核对：`45b5ea363456f6ec0dfd6dda3635dfa1d79007c0^:docs/decisions/decision-records/express-alignment-as-field-relation.md`。
- 完整采用方向：active 即生效；alignment 只在 frontmatter 表达离散关系，索引仅投影该值，实际差距通过决策与 owner 比较得出。
- 区分性依据：
  - `45b5ea363456f6ec0dfd6dda3635dfa1d79007c0^:docs/decisions/decision-records/express-alignment-as-field-relation.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 3 个身份快照均为 archived/null，未重新激活。

#### `generate-index-from-self-contained-decisions` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/generate-index-from-self-contained-decisions.md`；修复前 SHA-256：`b22ba0e11f4be7a3180df3de149018d680bc95cecbdf7572e8dc90399b0573cb`。
- 历史核对：`decb5a87b01d5fdc57dcd07bce1ad108d0d67925^:docs/decisions/decision-records/generate-index-from-self-contained-decisions.md`。
- 完整采用方向：决策文件保存 status、alignment 和 createdAt 等权威元数据；集中 JSON 索引完全由 Markdown 生成，不拥有独立事实。
- 区分性依据：
  - `decb5a87b01d5fdc57dcd07bce1ad108d0d67925^:docs/decisions/decision-records/generate-index-from-self-contained-decisions.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `index-ledger-by-stable-case-state` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/index-ledger-by-stable-case-state.md`；修复前 SHA-256：`73279d664762bcac89c0019b4e4ef1bf3ca201468ceb2682020ba9feaa692e7a`。
- 历史核对：`ea0be0edecbee561ef06312c10de2cd8f8c59a12^:docs/decisions/test-evidence-review/index-ledger-by-stable-case-state.md`。
- 完整采用方向：测试领域只提供以 case ID 为身份的紧凑 state、revision、keys 和动态状态，通用层统一拥有索引外壳、新鲜度、同步以及 `query|get|all`。
- 区分性依据：
  - `ea0be0edecbee561ef06312c10de2cd8f8c59a12^:docs/decisions/test-evidence-review/index-ledger-by-stable-case-state.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `organize-native-test-cases-by-responsibility-topic` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/organize-native-test-cases-by-responsibility-topic.md`；修复前 SHA-256：`208f4d9aac3dc1a66cd1bf1b3a75af34103855014630293171fe5f1b1df6eb9e`。
- 历史核对：`034e0a15daeb333637408aaf71d956f65782204a^:docs/decisions/test-evidence-review/organize-native-test-cases-by-responsibility-topic.md`。
- 完整采用方向：每个最小原生测试入口仍对应一个 case，权威目录按稳定测试责任拆分主题 Markdown，并由统一索引跨文件查询和定点展开。
- 区分性依据：
  - `034e0a15daeb333637408aaf71d956f65782204a^:docs/decisions/test-evidence-review/organize-native-test-cases-by-responsibility-topic.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `organize-test-cases-by-controlled-topic-path` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/organize-test-cases-by-controlled-topic-path.md`；修复前 SHA-256：`55f044231b0b49664cc9b2c4f7a2b040571d80044a8cf6acbe8595cca0bd2d21`。
- 历史核对：`8788cf110827296405b0abdf772add33b77e3887^:docs/decisions/test-evidence-review/organize-test-cases-by-controlled-topic-path.md`。
- 完整采用方向：由受控主题表定义责任域，每个 case 独占一个主题路径文件，并由统一索引投影主题 metadata 和路径派生查询 key。
- 区分性依据：
  - `8788cf110827296405b0abdf772add33b77e3887^:docs/decisions/test-evidence-review/organize-test-cases-by-controlled-topic-path.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `publish-only-layered-test-evidence-interfaces` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/publish-only-layered-test-evidence-interfaces.md`；修复前 SHA-256：`94886d7d4a4bbe9416858dc10024692cfa6c2023f2d9c91fcc702ae8f59b8f8d`。
- 历史核对：`ea0be0edecbee561ef06312c10de2cd8f8c59a12^:docs/decisions/test-evidence-review/publish-only-layered-test-evidence-interfaces.md`。
- 完整采用方向：以 Schema 为结构真源，只发布采集层和账本层两套接口，旧版升级仅由独立文档承接。
- 区分性依据：
  - `ea0be0edecbee561ef06312c10de2cd8f8c59a12^:docs/decisions/test-evidence-review/publish-only-layered-test-evidence-interfaces.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `query-projected-decision-metadata` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/query-projected-decision-metadata.md`；修复前 SHA-256：`f2d0bd7f7e9d983c6ad02910512f0847f3b6b78fb106d8229846ff9a1ef1eedc`。
- 历史核对：`8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/query-projected-decision-metadata.md`。
- 完整采用方向：list、show 和 trace 查询 JSON 投影；状态、alignment 与创建时间均来自 Markdown，索引不拥有独立值。
- 区分性依据：
  - `8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/query-projected-decision-metadata.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `read-ledger-contract-on-demand` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/read-ledger-contract-on-demand.md`；修复前 SHA-256：`f473895792c1da24cf640c12a6b9c42a8136e8be07c2a3876f8c97a52c0f7b1a`。
- 历史核对：`ea0be0edecbee561ef06312c10de2cd8f8c59a12^:docs/decisions/test-evidence-review/read-ledger-contract-on-demand.md`。
- 完整采用方向：所有任务继续受账本契约约束，但仅在写入、结构审阅、修复或精确诊断时完整读取；日常恢复先用 list/show/check。
- 区分性依据：
  - `ea0be0edecbee561ef06312c10de2cd8f8c59a12^:docs/decisions/test-evidence-review/read-ledger-contract-on-demand.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `recover-current-format-tools-and-index` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/recover-current-format-tools-and-index.md`；修复前 SHA-256：`66c1340570551196178c477f6ef454e1152b2050f5d5969efb8fc2cf3f9183be`。
- 历史核对：`a92e00087d4eec90a8c549a39d4490902a0600b8^:docs/decisions/decision-records/recover-current-format-tools-and-index.md`。
- 完整采用方向：恢复手册只处理当前格式；优先恢复当前 CLI，再从 Markdown 重建 schema v4 索引，不读取、迁移或推断其他 schema。
- 区分性依据：
  - `a92e00087d4eec90a8c549a39d4490902a0600b8^:docs/decisions/decision-records/recover-current-format-tools-and-index.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档提交将“schema v4”改为“当前索引/固定契约”，仍要求只恢复当前格式并由 Markdown 重建索引；随后 decb5a87 仅将索引摘要迁入 frontmatter。扫描归档后 3 个身份快照均为 archived/null，未重新激活。

#### `register-one-case-per-independent-verification-entry` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/register-one-case-per-independent-verification-entry.md`；修复前 SHA-256：`148748b9d0d81d47f666dea2610b22aa2a7d9544f4f8ea62796aacc2d66ea8ae`。
- 历史核对：`ed5dc4b4e11c443954484b6305d7eb2fcd4aa2f2^:docs/decisions/test-evidence-review/register-one-case-per-independent-verification-entry.md`。
- 完整采用方向：每个项目保留的独立验证入口各登记一个 case，内部环节归入父入口；入口身份由稳定选择方式和自身最终判定确定。
- 区分性依据：
  - `ed5dc4b4e11c443954484b6305d7eb2fcd4aa2f2^:docs/decisions/test-evidence-review/register-one-case-per-independent-verification-entry.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `review-verification-implementations-with-explicit-indexed-cases` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/review-verification-implementations-with-explicit-indexed-cases.md`；修复前 SHA-256：`096a37f0ae132b5a78ae8908d03882501fbdb018314eafad5a22a2098c4f4669`。
- 历史核对：`efd1a3fadbac34b39034ec6aa255cd5d0a73246c^:docs/decisions/test-evidence-review/review-verification-implementations-with-explicit-indexed-cases.md`。
- 完整采用方向：使用 `verification-implementation-review` 审查 test/check 实现；只登记显式 case，移除采集、marker、自动注册与范围触发，保留派生索引查询。
- 区分性依据：
  - `efd1a3fadbac34b39034ec6aa255cd5d0a73246c^:docs/decisions/test-evidence-review/review-verification-implementations-with-explicit-indexed-cases.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `separate-activation-effect-from-head-pending` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/separate-activation-effect-from-head-pending.md`；修复前 SHA-256：`2e0d4f806c168c985fad585cd2873870918f21c32533ac5fe8d9d869d53710d4`。
- 历史核对：`8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/separate-activation-effect-from-head-pending.md`。
- 完整采用方向：活动记录激活即生效，HEAD 只决定路径是否临时显示 pending；pending 不改变确认、生命周期、对齐或生效状态。
- 区分性依据：
  - `8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/separate-activation-effect-from-head-pending.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `separate-distributable-tool-source-from-repository-automation` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/separate-distributable-tool-source-from-repository-automation.md`；修复前 SHA-256：`66f4ab9ba01f1c9746a81e10931ea4b783e1207183af40d921fccd281e3c7315`。
- 历史核对：`e4f35740be7fedfb09189b34b44f6c572a83942e^:docs/decisions/project-tooling/separate-distributable-tool-source-from-repository-automation.md`。
- 完整采用方向：使用 `tools/` 维护可分发源码及共享协议，`scripts/` 只承接项目自动化，再生成自包含 skill 产物。
- 区分性依据：
  - `e4f35740be7fedfb09189b34b44f6c572a83942e^:docs/decisions/project-tooling/separate-distributable-tool-source-from-repository-automation.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：decb5a87 的正文差异仅将标题、目的、背景、决策和关系从正文索引摘要投影到 frontmatter；完整“决策”方向未改变。扫描归档后 3 个身份快照均为 archived/null，未重新激活。

#### `use-configurable-self-contained-decision-root` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/use-configurable-self-contained-decision-root.md`；修复前 SHA-256：`a3b4875b8c24eaa2b9c6b4970ba22c62dac04ef68ce8cb0d8f845ca0952570ec`。
- 历史核对：`8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/use-configurable-self-contained-decision-root.md`。
- 完整采用方向：默认使用 root/docs/decisions；显式 decisions-dir 直接选择目标，绝对路径可在 root 外，非绝对路径只相对 root 解析。
- 区分性依据：
  - `8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/use-configurable-self-contained-decision-root.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `use-field-alignment-commands` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/use-field-alignment-commands.md`；修复前 SHA-256：`2eb414efc438b56b59d5be8f66ebb9a83be70e799da41dab6a9181ed77aa0b09`。
- 历史核对：`8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/use-field-alignment-commands.md`。
- 完整采用方向：activate 显式设置 alignment，mark-aligned 只更新字段，check 校验结构与投影；正文不随对齐状态分叉。
- 区分性依据：
  - `8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/use-field-alignment-commands.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `use-frontmatter-projection-and-semantic-field-order` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/use-frontmatter-projection-and-semantic-field-order.md`；修复前 SHA-256：`8ae3937f6509b6204d2874940097e66c6ec578525ef0fe0236a9e487335017f5`。
- 历史核对：`8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/use-frontmatter-projection-and-semantic-field-order.md`。
- 完整采用方向：Frontmatter 保存文档自有投影字段，索引对象使用固定语义字段序，条目仍按 ID 排序。
- 区分性依据：
  - `8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/decision-records/use-frontmatter-projection-and-semantic-field-order.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `use-independent-change-plans` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/use-independent-change-plans.md`；修复前 SHA-256：`03116390019b5a0b9a401ac32706ba35b3d315f965eb143b8d47e77c9c16741b`。
- 历史核对：`a0079d351a2230c2ecced72d7596f4a490124783^:docs/decisions/change-plan/use-independent-change-plans.md`。
- 完整采用方向：新增独立 `change-plan`，以三文件临时计划和只读结构检查器承接规划，不拥有稳定事实、长期决策或实施许可。
- 区分性依据：
  - `a0079d351a2230c2ecced72d7596f4a490124783^:docs/decisions/change-plan/use-independent-change-plans.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

#### `use-independent-read-side-index-runtime` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`recorded`。
- 原始对象：`docs/decisions/archive/use-independent-read-side-index-runtime.md`；修复前 SHA-256：`f398f75517966ad831691c04167f914abab4a091f7ab366af9704c61fc672a37`。
- 历史核对：`8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/index-runtime/use-independent-read-side-index-runtime.md`。
- 完整采用方向：领域提供 state、唯一 id、revision 和多 key 策略，通用层只管理派生副本、查询与确定性文件同步。
- 区分性依据：
  - `8dd0c02b99a37d8754510929aa93fb586fda5276^:docs/decisions/index-runtime/use-independent-read-side-index-runtime.md`：直接父版 frontmatter 明确为 status: active、alignment: aligned；该文件身份由文件名/（迁移后）id 与目标一致。
- 后续正文核对与局限：归档后正文与归档版本逐字相同；扫描归档后 2 个身份快照均为 archived/null，未重新激活。

### `semantic`（57 条）

#### `260713-recall-before-long-lived-changes` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260713-recall-before-long-lived-changes.md`；修复前 SHA-256：`b2566136f27b7ea8873c1ec0904541de0fa1f49dfab06a3a7ade5212773776fe`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records-skill/260713-recall-before-long-lived-changes.md`。
- 完整采用方向：在改变长期行为前从当前 JSON 索引恢复相关决策，并把偏离归类为对齐、一次性例外、长期修订或一致性问题。
- 区分性依据：
  - `6cdf156effa2855cd94f3b0f18258b33865072cb:docs/decisions/decision-records-skill/260713-recall-before-long-lived-changes.md`：完整“决定”规定长期变更前读取当前索引、按目的/背景/决定对照事实，并给出四类偏离处理与冷启动短路由边界。
  - `9cb979ef65553ad900c1717a0f56d66af27ef769:skills/decision-records/SKILL.md`：“主动读取”和“恢复当前判断”要求在长期决定或冲突前定位索引、读取必要 Markdown，并按对齐/例外/修订/一致性问题处理，落实该行为协议。
  - `6cdf156effa2855cd94f3b0f18258b33865072cb:scripts/decision-records/src/cli.ts`：实现 list、trace、activate、archive 和 JSON 索引校验入口，提供该恢复协议依赖的确定性当前/历史查询能力。
- 后续正文核对与局限：从 6cdf 创建版本至 9cb（3a124c 的直接父）只增加目的章节并将“决定”改名为“决策”；完整采用方向未变。

#### `260713-use-json-current-index-and-stable-paths` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260713-use-json-current-index-and-stable-paths.md`；修复前 SHA-256：`afbf7058210be1ba9944d2987a42dc6a74eff262516bb87d619b9f16a38e3264`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260713-use-json-current-index-and-stable-paths.md`。
- 完整采用方向：以 JSON 当前索引保存成员和显式 Markdown 摘要，保持决策路径稳定，逻辑归档与单向直接关系分离。
- 区分性依据：
  - `6cdf156effa2855cd94f3b0f18258b33865072cb:docs/decisions/decision-records/260713-use-json-current-index-and-stable-paths.md`：完整“决定”逐项定义 JSON 唯一成员 owner、稳定 YYMMDD 路径、逻辑归档、显式摘要投影和单向直接关系。
  - `6cdf156effa2855cd94f3b0f18258b33865072cb:scripts/decision-records/src/cli.ts`：CLI 将 list 默认限定当前集合，并以 activate/archive 维护成员、sync-index 仅刷新派生摘要，实际分离成员变更与投影刷新。
  - `6cdf156effa2855cd94f3b0f18258b33865072cb:scripts/decision-records/tests/run.ts`：历史测试夹具对 current/archived 列表、关系 trace、成员切换和索引漂移后的 sync-index 进行断言。
- 后续正文核对与局限：至 9cb 的修改仅压缩索引摘要、补目的章节和章节名称；完整“决定”中的 JSON、稳定路径、归档和关系约束未被改写。

#### `260718-add-direction-and-depth-to-trace` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260718-add-direction-and-depth-to-trace.md`；修复前 SHA-256：`626bdc0dba4cee442b1c22333ca82dcb42246b17c03668aecc5735db5cc70dd7`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260718-add-direction-and-depth-to-trace.md`。
- 完整采用方向：trace 保持默认双向完整遍历，并支持前序、后续、双向及非负最大深度查询。
- 区分性依据：
  - `e019307576f481b8ea22507cfa83a288c74ebc7b:docs/decisions/decision-records/260718-add-direction-and-depth-to-trace.md`：完整“决定”明确默认 both、predecessors|successors|both、depth=0 与无上限语义，并限定使用现有邻接表/BFS。
  - `e019307576f481b8ea22507cfa83a288c74ebc7b:scripts/decision-records/src/cli.ts`：runTrace 分别构建 predecessor/successor 邻接表，在队列携带 depth，并按 traceDirection 与 traceDepth 决定扩展。
  - `e019307576f481b8ea22507cfa83a288c74ebc7b:scripts/decision-records/tests/run.ts`：断言 predecessors 不返回后继、successors 返回反查后继，且 depth 1/2 分别截断或包含更早前序。
- 后续正文核对与局限：到 9cb 只补充目的章节并将“决定”标题规范为“决策”；四项 trace 方向与深度语义保持不变。

#### `260718-notify-before-decision-writes` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260718-notify-before-decision-writes.md`；修复前 SHA-256：`d1dcc1b2835e204a3b7166d088404c189ef6f3eab6534eb6d30afcb4cc0bb0b9`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records-skill/260718-notify-before-decision-writes.md`。
- 完整采用方向：已有明确维护意图时不重复询问操作授权，但在新增、调整或退出当前集合前说明判断和集合变化。
- 区分性依据：
  - `e019307576f481b8ea22507cfa83a288c74ebc7b:docs/decisions/decision-records-skill/260718-notify-before-decision-writes.md`：完整“决定”区分操作授权、长期判断与写前通知，并规定一次性例外、范围不清和非标准迁移的处理。
  - `e019307576f481b8ea22507cfa83a288c74ebc7b:skills/decision-records/SKILL.md`：“区分任务意图”和完成标准直接要求不重复询问已表达的维护意图，并在集合变动前告知写入判断与集合变化。
- 后续正文核对与局限：创建后到 9cb 只增加目的章节和标题规范化；五条完整写前通知/授权边界未发生实质修改。

#### `260718-separate-behavior-entry-from-storage-contract` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260718-separate-behavior-entry-from-storage-contract.md`；修复前 SHA-256：`29bdb0542ea693c244cef44c0fea6d64cf75a5b2c9c288b54e8b8f8e6a677c0b`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260718-separate-behavior-entry-from-storage-contract.md`。
- 完整采用方向：由 SKILL.md 承接语义恢复和编排，由随包 reference 独占精确存储/维护契约，并按操作类型控制读取。
- 区分性依据：
  - `f2d35755d89ab4a1fe05b6f5bf97b7294b5baffc:docs/decisions/decision-records/260718-separate-behavior-entry-from-storage-contract.md`：完整“决策”明确入口、唯一 reference、只读/候选不读契约、维护前完整读契约及 CLI 的职责划分。
  - `f2d35755d89ab4a1fe05b6f5bf97b7294b5baffc:skills/decision-records/SKILL.md`：Owner 与读取步骤把语义恢复放在入口，将创建、修订、归档、修复和结构审阅前读取 reference 的门槛写入实际行为入口。
  - `f2d35755d89ab4a1fe05b6f5bf97b7294b5baffc:skills/decision-records/references/decision-record-rules.md`：开头明确 reference 仅承接精确存储维护约束，并反向指定触发、语义恢复与交付由 SKILL.md 承接。
- 后续正文核对与局限：至 9cb 仅把摘要措辞从详细列举压缩为“恢复/候选”等；正文六条 owner 与按需读取方向未变。

#### `260718-separate-logical-archive-from-relations` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260718-separate-logical-archive-from-relations.md`；修复前 SHA-256：`a483ffd3fea542f81e8535ea35a7c8adcca44c0f00caf39c80206ee8846ee58a`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260718-separate-logical-archive-from-relations.md`。
- 完整采用方向：允许无后继的独立逻辑归档；仅真实演进建立单向关系，并校验 archive --by 的直接承接和关系无环。
- 区分性依据：
  - `9871d7b71d6c7cd3ddc3864c4c16b4805194dfe9:docs/decisions/decision-records/260718-separate-logical-archive-from-relations.md`：完整“决定”列出 JSON 成员 owner、稳定路径、独立归档、真实演进关系、--by 直接目标和无环反查。
  - `9871d7b71d6c7cd3ddc3864c4c16b4805194dfe9:scripts/decision-records/src/cli.ts`：archive 可在无 --by 时仅移出成员；有 --by 时以 successor.relations 计算缺失直接目标并拒绝不完整承接。
  - `9871d7b71d6c7cd3ddc3864c4c16b4805194dfe9:scripts/decision-records/tests/run.ts`：测试独立 archive 后计数，拒绝无直接关系的 --by，补直接替代关系后成功，并断言关系环被检查器拒绝。
- 后续正文核对与局限：到 9cb 只压缩摘要、增加目的章节和标题改名；完整逻辑归档与真实关系边界未改变。

#### `260718-use-purpose-background-decision-structure` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260718-use-purpose-background-decision-structure.md`；修复前 SHA-256：`57f5c0cfa00e65b15682faf9c90814b739748ff07403c73f487f167e9237fc56`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260718-use-purpose-background-decision-structure.md`。
- 完整采用方向：Markdown 显式区分索引摘要、目的、背景、决策；schema v2 索引保存对应摘要投影。
- 区分性依据：
  - `72559e9e9de2450ad632ddd6d81adc2c4feff03d:docs/decisions/decision-records/260718-use-purpose-background-decision-structure.md`：完整“决策”规定四个章节、三字段摘要不能引入独有语义、schema v2 投影和既有生命周期/关系事务。
  - `72559e9e9de2450ad632ddd6d81adc2c4feff03d:scripts/decision-records/src/decision-index.ts`：严格 schema 要求 schemaVersion: 2，且每个 current 条目必须有 path、title、purpose、background、decision。
  - `72559e9e9de2450ad632ddd6d81adc2c4feff03d:scripts/decision-records/tests/run.ts`：测试将 schemaVersion 改为 1 及缺失 purpose 的情形均断言为错误，验证 v2 投影与正文要求。
- 后续正文核对与局限：至 9cb 仅把索引摘要压缩成简述；完整章节、摘要投影和 schema v2 的采用条款未变。

#### `260719-model-verification-obligations-and-source-roles` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260719-model-verification-obligations-and-source-roles.md`；修复前 SHA-256：`418138d12feadf72311e4fea52fa98e4d138117f0b5442f60a02775bfa9f95ba`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/test-evidence-review-behavior/260719-model-verification-obligations-and-source-roles.md`。
- 完整采用方向：将账本 case 建模为 automated、review、exempt 验证义务，并以 main、derived、exempt 源码角色进行机械映射校验。
- 区分性依据：
  - `8618b0ccc377ab36b050991370bb2322d9152b13:docs/decisions/test-evidence-review-behavior/260719-model-verification-obligations-and-source-roles.md`：完整“决策”逐项定义四种合法 case 组合、review/exempt 所需字段、三种 marker、文件归属和 CLI 边界。
  - `8618b0ccc377ab36b050991370bb2322d9152b13:scripts/test-evidence/src/evidence-validation.ts`：验证器按 active automated/review/exempt 分类，检查 main Code 一致、exempt 映射、角色类型、同文件 main/derived 冲突和未登记测试文件。
  - `8618b0ccc377ab36b050991370bb2322d9152b13:scripts/test-evidence/tests/run.ts`：有效工作区断言 1 个 review、1 个 exempt、main/derived/exempt 映射及零未登记文件；fixture 同时覆盖 Scope、Risk、Reason、Review。
- 后续正文核对与局限：至 9cb 只将摘要从完整术语压缩为简述；完整九条验证义务、marker 与 CLI 分工未变。

#### `260719-organize-multi-branch-proofs-by-shared-base` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260719-organize-multi-branch-proofs-by-shared-base.md`；修复前 SHA-256：`0ba0e0cd0adfddb9ad8d49a4a0b868683c16004e05e3ea6c512ad2a30b36caa7`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/test-evidence-review-behavior/260719-organize-multi-branch-proofs-by-shared-base.md`。
- 完整采用方向：automated case 可按共享基座或连续链路聚合分支，使用原子 Proves 与 Mermaid 表达分支，仅在独立边界降低总成本时拆分。
- 区分性依据：
  - `aa1bbb7bd1c05b1e899121ebd6d2c4a597aeca0b:docs/decisions/test-evidence-review-behavior/260719-organize-multi-branch-proofs-by-shared-base.md`：完整“决策”规定 shared base 聚合条件、原子 Proves、flowchart LR|TD 与 subgraph 表达，以及独立 owner/入口/环境等拆分条件。
  - `aa1bbb7bd1c05b1e899121ebd6d2c4a597aeca0b:skills/test-evidence-review/references/ledger-contract.md`：历史账本契约将 automated case 定义为共享基座或连续行为链路审计单元，并要求多分支使用 Proves 与 Mermaid 结构。
  - `aa1bbb7bd1c05b1e899121ebd6d2c4a597aeca0b:scripts/test-evidence/tests/run.ts`：有效账本 fixture 用两个 Proves、共享 calculator fixture、分支节点和 subgraph leaf assertions，CLI 验证通过该 case 格式。
- 后续正文核对与局限：到 9cb 只压缩摘要中的 Mermaid 细节；完整六条共享基座、原子证明和拆分判断仍在正文。

#### `260719-own-project-aware-skill-lifecycle` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260719-own-project-aware-skill-lifecycle.md`；修复前 SHA-256：`0e934ca0b44d136bda5707a7a38ffa0a53a89d11dc819e3bac55d589553e6d1c`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/skill-maintainer-behavior/260719-own-project-aware-skill-lifecycle.md`。
- 完整采用方向：由 skill-maintainer 承接能力归属和可移植 skill 生命周期，采用自包含最小基线加环境适配，并随包提供结构验证器。
- 区分性依据：
  - `97d493e2243c599ee5a7d51373482f598f230ecc:docs/decisions/skill-maintainer-behavior/260719-own-project-aware-skill-lifecycle.md`：完整“决策”定义独立 skill、五类能力、最小交付、随包验证器、主仓库源码/构建 owner、环境适配与授权边界。
  - `97d493e2243c599ee5a7d51373482f598f230ecc:skills/skill-maintainer/SKILL.md`：实际 skill 提供能力归属流程、五类模型、最小基线/环境集成、验证器使用和完成检查。
  - `97d493e2243c599ee5a7d51373482f598f230ecc:scripts/skill-validator/tests/run.ts`：历史测试对有效 portable skill、生成验证器成功、无效 name/description/资源目录/内外链接和空正文的失败诊断逐项断言。
- 后续正文核对与局限：创建后至 9cb 的历史只涉及生命周期/格式迁移；该记录完整采用方向没有实质正文改动。

#### `260719-separate-test-value-from-ledger-validation` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260719-separate-test-value-from-ledger-validation.md`；修复前 SHA-256：`4bde96d603094d018771f04fd287f2293106e8698a8949801ccd1886aa0395fc`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/test-evidence-review-behavior/260719-separate-test-value-from-ledger-validation.md`。
- 完整采用方向：以 test-evidence-review 先审查测试证据价值，再默认登记稳定证明目标，并用跨语言 CLI 机械校验账本与源码映射。
- 区分性依据：
  - `c3b11405a004b06295f8d23dc7ca10472706d224:docs/decisions/test-evidence-review-behavior/260719-separate-test-value-from-ledger-validation.md`：完整“决策”规定独立 skill、每次触发账本契约、稳定证明目标而非函数清单、跨语言文件发现和 CLI/测试框架分工。
  - `c3b11405a004b06295f8d23dc7ca10472706d224:scripts/test-evidence/src/validation.ts`：验证器将 implemented/planned case、主要/辅助/豁免 marker、账本 Code、发现测试文件和 ignore/warn/error 未登记策略分开检查。
  - `c3b11405a004b06295f8d23dc7ca10472706d224:scripts/test-evidence/tests/run.ts`：有效 fixture 断言 case、primary/supporting/exempt 和多语言发现汇总；warning/error 未登记、planned marker 和无效 marker 都有失败断言。
- 后续正文核对与局限：至 9cb 仅将可消费结论的相邻 owner 从 code-review 改为 product-architecture-thinking；测试价值、账本与 CLI 的完整方向未变。

#### `260720-auto-initialize-index-on-first-activation` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-auto-initialize-index-on-first-activation.md`；修复前 SHA-256：`35ef384bb97e12182a8d63f2f4225f74a1596c9355db3e2d017aeb17c26ee9bd`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260720-auto-initialize-index-on-first-activation.md`。
- 完整采用方向：首次 activate 在唯一目标和其余结构有效时创建 schema v2 索引；无效既有索引不覆盖，校验失败删除新索引。
- 区分性依据：
  - `26b84ae19a14448a267afc4f72124cdcce69393f:docs/decisions/decision-records/260720-auto-initialize-index-on-first-activation.md`：完整“决策”明确首条写入、可初始化前提、写后 check/删除、无效索引不覆盖，以及 sync-index/archive 不初始化。
  - `26b84ae19a14448a267afc4f72124cdcce69393f:scripts/decision-records/src/cli.ts`：canInitializeIndex 限制为目录可用、索引缺失且仅有索引缺失诊断；writeValidatedIndex 在新索引校验失败时 fs.rm 新文件。
  - `26b84ae19a14448a267afc4f72124cdcce69393f:scripts/decision-records/tests/run.ts`：测试先让首激活因关系错误失败且确认索引不存在，再激活有效目标并断言“Initialized ... and activated”和恢复的原索引内容。
- 后续正文核对与局限：到 9cb 仅压缩索引摘要；完整 activate 前提、无效索引保留与失败清理条款没有变化。

#### `260720-complete-by-task-outcome` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-complete-by-task-outcome.md`；修复前 SHA-256：`09cd400467e86d470ed8b89351470c455e58efdba0a64186b5a7e28abb9973b9`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records-skill/260720-complete-by-task-outcome.md`。
- 完整采用方向：按恢复/审阅、候选和维护/迁移设置不同完成门槛；查询 warning 限定结论，严格 check 仅是写入与迁移门禁。
- 区分性依据：
  - `e53bf1a9b3c6e9b719befb602f8fe47d36581426:docs/decisions/decision-records-skill/260720-complete-by-task-outcome.md`：完整“决策”分别规定可恢复查询、候选和写入迁移的完成条件，并禁止由 warning 推断缺失关系或记录不存在。
  - `e53bf1a9b3c6e9b719befb602f8fe47d36581426:skills/decision-records/SKILL.md`：“确定任务出口”及三组“完成标准”实际区分恢复/审阅、候选、维护/迁移，并仅为维护/迁移要求严格 check。
- 后续正文核对与局限：至 9cb 只压缩索引摘要；三类出口、warning 结论边界和严格 check 门禁均保留。

#### `260720-define-skills-by-self-contained-contracts` — `alignment: unaligned`

- 主审批准的最终值：`unaligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-define-skills-by-self-contained-contracts.md`；修复前 SHA-256：`1375de34d923679d3613e315b4019eaf382ac224231824894e5544e0a5912a46`。
- 历史核对：`c36fbdaf3cd044c2a616efbbae5de92ce528faac:docs/decisions/skill-maintainer-behavior/260720-define-skills-by-self-contained-contracts.md`。
- 完整采用方向：维护时可比较相邻能力，但分发的 skill 只以自身输入、目标、步骤、边界和验收定义可独立执行的契约。
- 区分性依据：
  - `c36fbdaf3cd044c2a616efbbae5de92ce528faac:docs/decisions/skill-maintainer-behavior/260720-define-skills-by-self-contained-contracts.md`：完整“决策”要求每个分发后的 skill 只以自身契约定义能力，不假定其他 skill 存在。
  - `c36fbdaf3cd044c2a616efbbae5de92ce528faac:docs/decisions/decision-index.json`：建立该记录的同一提交中，JSON 的 current 未包含此 Markdown 路径；没有该判断进入当前集合或被核对建立的历史登记证据。
  - `c36fbdaf3cd044c2a616efbbae5de92ce528faac:docs/decisions/skill-maintainer-behavior/260720-use-distribution-unit-boundaries.md`：同提交建立的记录以“判定无效”直接指向本记录，并明确允许同一 distribution unit 内成员显式点名、调用和依赖。
  - `c36fbdaf3cd044c2a616efbbae5de92ce528faac:skills/skill-maintainer/SKILL.md`：实际契约把独立交付边界放在 distribution unit，并在“定义行为和依赖契约”允许单元内 skill 依赖；未落实每个分发 skill 都不假定其他 skill 的方向。
- 后续正文核对与局限：创建后至 9cb 的记录正文未改写；没有更早 active/aligned 登记，且建立提交本身即未将其加入 current，并用同提交后继“判定无效”。

#### `260720-keep-problem-reframing-self-contained` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-keep-problem-reframing-self-contained.md`；修复前 SHA-256：`ce2c6fb2de6a8225394535ff0873fa23b094644a1fc086e3d05bdffb135a775b`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/problem-reframing-behavior/260720-keep-problem-reframing-self-contained.md`。
- 完整采用方向：以独立 problem-reframing skill 在框架风险时恢复目标、事实、约束和边界，选择最小有证据的问题框架后交回当前任务。
- 区分性依据：
  - `83d58245adf93cb2b8174dc8d74f5bde5071ae1e:docs/decisions/problem-reframing-behavior/260720-keep-problem-reframing-self-contained.md`：完整“决策”规定独立流程与决策型 skill、风险触发、框架候选/最小调查、五类处置以及交回当前 owner/授权。
  - `83d58245adf93cb2b8174dc8d74f5bde5071ae1e:skills/problem-reframing/SKILL.md`：历史 skill 的 description、判断对象和执行流程直接实现框架风险触发、恢复目标/前提/边界、最小框架选择和交回任务。
- 后续正文核对与局限：从创建到 9cb，记录正文未发生实质修改；后来分发单元被替代不改变其在建立时已落实的完整协议。

#### `260720-return-query-results-with-warnings` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-return-query-results-with-warnings.md`；修复前 SHA-256：`b52969123392bc0f04ec5fa4a99b40b22bee805eb227c3d2d87bee5e6a7380b4`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260720-return-query-results-with-warnings.md`。
- 完整采用方向：当中央索引与目标可解析时 list/trace 返回可恢复结果并输出 warning；check 和写事务继续严格失败。
- 区分性依据：
  - `26b84ae19a14448a267afc4f72124cdcce69393f:docs/decisions/decision-records/260720-return-query-results-with-warnings.md`：完整“决策”区分中央索引/起点的阻断条件与局部正文、关系、投影错误的非阻断 warning 条件。
  - `26b84ae19a14448a267afc4f72124cdcce69393f:scripts/decision-records/src/cli.ts`：查询路径将可恢复结果与诊断分离；写命令仍以 scan.errors 严格阻断，激活初始化也仅放行唯一的索引缺失错误。
  - `26b84ae19a14448a267afc4f72124cdcce69393f:scripts/decision-records/tests/run.ts`：测试损坏正文时 list/trace 仍以 exit 0 输出 [invalid] 和 warning，索引无效时 list exit 1，索引漂移时查询返回结果并报告诊断。
- 后续正文核对与局限：到 9cb 只有摘要压缩；完整阻断/非阻断边界、stderr warning 和成功退出语义未变。

#### `260720-separate-editorial-edits-from-evolution` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-separate-editorial-edits-from-evolution.md`；修复前 SHA-256：`5450d5cd2b60eb4c550a7e075d4349e0625ed29cb3be9b884e7cc74de8f649aa`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260720-separate-editorial-edits-from-evolution.md`。
- 完整采用方向：仅不改变决策语义的编辑可原地修正；目的、范围、前提、采用、理由或关系语义变化必须新建并按真实演进处理。
- 区分性依据：
  - `26b84ae19a14448a267afc4f72124cdcce69393f:docs/decisions/decision-records/260720-separate-editorial-edits-from-evolution.md`：完整“决策”列出可原地的错字/格式/链接/澄清、需新建的六类语义变化，以及不确定时按演进并请求判断。
  - `26b84ae19a14448a267afc4f72124cdcce69393f:skills/decision-records/references/decision-record-rules.md`：“正文规则”和“编辑性修正”逐字落入固定契约：原地范围、需新记录的语义字段、sync-index 与 check 的后续动作均明确。
- 后续正文核对与局限：创建后到 9cb 的正文没有实质变更；编辑性修正与演进的完整边界保持不变。

#### `260720-separate-framing-from-engineering-landing` — `alignment: unaligned`

- 主审批准的最终值：`unaligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-separate-framing-from-engineering-landing.md`；修复前 SHA-256：`b6765b29a1147e79f14bce3618449e3b34ffdc8ac59926f19ab44dc7a0106560`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/product-architecture-thinking-behavior/260720-separate-framing-from-engineering-landing.md`。
- 完整采用方向：继续由 skills/product-architecture-thinking/ 作为独立分发单元承接工程落地，仅在改变目标或问题选择时交接上游框架判断。
- 区分性依据：
  - `dc4b7ab6d9baba70dd8ff1cff903e6ed4a713cc2:docs/decisions/product-architecture-thinking-behavior/260720-separate-framing-from-engineering-landing.md`：完整“决策”第一条明确要求继续由 `skills/product-architecture-thinking/` 承接并作为独立分发单元维护。
  - `dc4b7ab6d9baba70dd8ff1cff903e6ed4a713cc2:skills/`：同一历史 tree 中 `skills/product-architecture-thinking/` 已删除，只有新建的 `skills/product-architecture-judgment/SKILL.md`；采用方向指定的分发路径并未建立。
- 后续正文核对与局限：从创建到 9cb 该记录正文未改写；因此未出现将采用路径改为 product-architecture-judgment 的语义修正。

#### `260720-separate-status-commands-from-relations` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-separate-status-commands-from-relations.md`；修复前 SHA-256：`547f6f8706ecfc7c86022446da9d56e3b7d14147e24c44eb79726bfeb7f0bcbe`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260720-separate-status-commands-from-relations.md`。
- 完整采用方向：activate 只激活、archive 只归档，关系不隐式改变状态；组合切换须由显式命令完成。
- 区分性依据：
  - `d78ac9f34a15d668b3f315e14633169f10769f1a:docs/decisions/decision-records/260720-separate-status-commands-from-relations.md`：完整“决策”要求分离 activate/archive 与关系、移除 archive --by 隐式激活，并为组合切换使用显式动作。
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:scripts/decision-records/src/cli-args.ts`：archive 子命令改为“Set active decisions to archived without changing related decisions”，并删除 --by option。
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:scripts/decision-records/tests/run.ts`：测试先 archive 前序并断言仅状态变 archived，再单独 activate 后继并断言 active；queries.test.ts 还断言 archive --by 为 unknown option。
- 后续正文核对与局限：创建到 9cb 记录正文未改写；2e1 的 CLI 与测试在归档前完成了原完整方向的实际落实。

#### `260720-use-configurable-decision-root` — `alignment: unaligned`

- 主审批准的最终值：`unaligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-use-configurable-decision-root.md`；修复前 SHA-256：`31149d8a4ed91e119b6d863948da364cbe966ee72154b8fbda2316971be42c93`。
- 历史核对：`9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/260720-use-configurable-decision-root.md`。
- 完整采用方向：默认使用工作区内 docs/decisions，并只允许 --decisions-dir 选择工作区内其他根目录，使身份和 owner 相对同一根解释。
- 区分性依据：
  - `e53bf1a9b3c6e9b719befb602f8fe47d36581426:docs/decisions/decision-records/260720-use-configurable-decision-root.md`：完整“决策”两次明确目录为“工作区内”，并要求所有 CLI 调用对同一集合使用该根。
  - `e53bf1a9b3c6e9b719befb602f8fe47d36581426:scripts/decision-records/src/scan.ts`：建立该记录的同一 tree 中，scanDecisionRecords 对绝对 --decisions-dir 直接 path.resolve(configuredDecisionDirectory)，对相对路径也直接 path.resolve(workspaceRoot, configuredDecisionDirectory)，没有 containment 检查；`../` 或绝对工作区外目录均可成为根。
- 后续正文核对与局限：至 9cb 仅压缩摘要；完整正文仍要求“工作区内”，未放宽为任意绝对或逃逸相对路径。

#### `260627-establish-decision-record-policy` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260627-establish-decision-record-policy.md`；修复前 SHA-256：`a80b53e4f393da758a8982f7811104d86eacae75304cccac0fb47d3951251bdd`。
- 历史核对：`f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-records/260627-amended-establish-decision-record-policy.md`。
- 完整采用方向：按稳定影响面组织高门槛决策；由清单和规则 owner 分别承接导航与维护契约，并删除低回放价值记录。
- 区分性依据：
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-records/260627-amended-establish-decision-record-policy.md`：完整正文将记录限为可回放的长期判断，明确影响面目录、两个 owner 与删除低价值记录。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-record-index.md`：索引实际按 decision-records、project-tooling、skill-references 三个影响面导航。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-record-rules.md`：规则实际承接门槛、影响面命名、文件和更新流程；与索引 owner 分离。
- 后续正文核对与局限：复核至归档前的后续正文：其将文件名和状态关系交给后继记录，但保留的高门槛、影响面和 owner 方向未出现反证。

#### `260630-publish-skill-package-as-latest-release` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260630-publish-skill-package-as-latest-release.md`；修复前 SHA-256：`34270d83893422d40bd1b86112e5c05d67873933c870ccc7b65a387d55149aba`。
- 历史核对：`f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/project-tooling/260630-active-publish-skill-package-as-latest-release.md`。
- 完整采用方向：所有触发先校验、打包并上传 artifact；仅 main push/workflow_dispatch 用单独写权限 publish job 更新 skills-latest 与 dist/*.zip。
- 区分性依据：
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/project-tooling/260630-active-publish-skill-package-as-latest-release.md`：历史 active 正文完整规定聚合 latest release、触发范围、assets 与 PR 非发布边界。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:.github/workflows/package-skills.yml`：package job 在三种触发下校验/打包/上传 dist/*.zip；publish job 有 main 及事件 guard、contents: write、skills-latest 和 gh release upload --clobber。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/tooling.md`：CI 章节同时说明 artifact 职责和仅 main push/manual 发布 skills-latest。
- 后续正文核对与局限：后续正文记录 hash、版本化 release 和单仓库的修订关系；这些是后继演进，不否定该时点的完整 latest 实现。

#### `260630-reorganize-prompt-optimize-rewrite-rules-as-pipeline` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260630-reorganize-prompt-optimize-rewrite-rules-as-pipeline.md`；修复前 SHA-256：`dff199a404ca1d8b785a21b8382bf1c513bffe02adbf96bc9cfc53d0d9819c1e`。
- 历史核对：`3ad002427e8615d0ebe6b870ab768ac310927ba3:docs/decisions/skill-references/2026-06-30-reorganize-rewrite-rules-as-pipeline.md`。
- 完整采用方向：以 rewrite-rules 的八步管线承接具体改写判断，workflows 只写顺序，principles 写理由，SKILL 只做导航和最小协议。
- 区分性依据：
  - `3ad002427e8615d0ebe6b870ab768ac310927ba3:docs/decisions/skill-references/2026-06-30-reorganize-rewrite-rules-as-pipeline.md`：完整正文列出四个文件 owner 与八步采用方向。
  - `3ad002427e8615d0ebe6b870ab768ac310927ba3:skills/prompt-optimize/references/rewrite-rules.md`：实际有 1 至 8 的任务出口、骨架、审计、owner、规则、负向描述、表达、沉淀管线。
  - `3ad002427e8615d0ebe6b870ab768ac310927ba3:skills/prompt-optimize/references/workflows.md`：改写工作流只枚举同一八步顺序，而具体判断留在 rewrite-rules。
- 后续正文核对与局限：后续 260630 merge 记录将该拆分方案标为 superseded；这是其后采用方向变化，不是该历史实现缺失。

#### `260630-track-decision-status-and-relations` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260630-track-decision-status-and-relations.md`；修复前 SHA-256：`a7954b9ccae21ed4f3d07aa0a0cd4c8f14ba8dcef3715da060dc15f319515b23`。
- 历史核对：`f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-records/260630-amended-track-decision-status-and-relations.md`。
- 完整采用方向：以文件名和正文状态表达 active/amended/superseded/invalidated，并以非 active 的后继链接和影响面目录维持可追溯性。
- 区分性依据：
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-record-rules.md`：实际定义四种状态、文件名状态段、非 active 后继链接和保持影响面一级目录。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-record-index.md`：索引实际按状态展示并把关系解释留给决策正文。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:scripts/validate-decisions.ts`：validator 检查四种状态、文件名/正文一致以及 non-active 后继链接存在。
- 后续正文核对与局限：后续正文显示其日期前缀和正文最小结构被 260630 compact 修订；状态和关系主体仍与历史实现一致。

#### `260630-use-compact-decision-records` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260630-use-compact-decision-records.md`；修复前 SHA-256：`15c93478c1846bdac740cf9370fd4a719eabde274676c78f13efe038ac44a3e2`。
- 历史核对：`f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-records/260630-active-use-compact-decision-records.md`。
- 完整采用方向：采用 YYMMDD-status 文件名和含状态、问题、决定、影响、验证的最小正文；背景与过程按需添加。
- 区分性依据：
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-records/260630-active-use-compact-decision-records.md`：完整 active 正文明确短日期、必需小节和两个可选小节。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-record-rules.md`：规则给出 YYMMDD-status 格式、最小/完整正文及可省略小节的条件。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:scripts/validate-decisions.ts`：validator 的 requiredSections 仅要求五个最小小节，并接受背景与过程缺席。
- 后续正文核对与局限：复核至后续归档前文本：未发现对该历史最小结构已实现状态的反证。

#### `260701-compact-entry-and-archive-migration-copies` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260701-compact-entry-and-archive-migration-copies.md`；修复前 SHA-256：`dcd4746dfed20443bb9a5f7e7cd1c5402600601e7c697068991293fb0a2f79d0`。
- 历史核对：`64decf7b479d78f98dc4dbff90226a62196c4a57:docs/decisions/prompt-optimize-references/260701-active-compact-entry-and-archive-migration-copies.md`。
- 完整采用方向：保持 SKILL 默认路径为按需展开的八步链，将旧 workflows/rewrite-rules 放入 references/archive，且 archive 不进入主动引用。
- 区分性依据：
  - `64decf7b479d78f98dc4dbff90226a62196c4a57:docs/decisions/prompt-optimize-references/260701-active-compact-entry-and-archive-migration-copies.md`：合并时仍可读的 active 正文完整规定八步入口和 archive 的非主动性质。
  - `64decf7b479d78f98dc4dbff90226a62196c4a57:skills/prompt-optimize/SKILL.md`：入口有八个按需判断步骤，主动引用仅含 principles、agent-tasks 和整体审阅，未列 archive。
  - `64decf7b479d78f98dc4dbff90226a62196c4a57:skills/prompt-optimize/references/archive/rewrite-rules.md`：文件头明确其为合并默认管线后的迁移保留副本且不再主动读取；workflows.md 具有同样说明。
- 后续正文核对与局限：后续正文与归档版本保持该方向；未用当前工作树作为证据。

#### `260701-embed-self-update-script-in-skill-packages` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260701-embed-self-update-script-in-skill-packages.md`；修复前 SHA-256：`22f7e2315e01e3f1159d01ee5348f2f49a4facac0cc43cd4d1d0c01c13e988f4`。
- 历史核对：`64decf7b479d78f98dc4dbff90226a62196c4a57:docs/decisions/project-tooling/260701-amended-embed-self-update-script-in-skill-packages.md`。
- 完整采用方向：以统一 TypeScript 模板和同步构建生成每个 skill 的独立 CJS updater，提供远端指纹检查、确认更新、来源链接和 check 防漂移。
- 区分性依据：
  - `64decf7b479d78f98dc4dbff90226a62196c4a57:scripts/templates/update-skill.ts`：模板使用 fflate 解压远端 zip，包含 fingerprint、--check、交互确认、临时目录替换和路径边界保护。
  - `64decf7b479d78f98dc4dbff90226a62196c4a57:scripts/sync-skill-updaters.ts`：同步器从统一模板生成 scripts/update-skill.cjs，并在 check 模式检测缺失或漂移。
  - `64decf7b479d78f98dc4dbff90226a62196c4a57:skills/prompt-optimize/scripts/update-skill.cjs`：已提交产物含生成头、模板 URL、skill source URL，并内嵌该 skill 的更新配置。
  - `64decf7b479d78f98dc4dbff90226a62196c4a57:package.json`：check 在历史版本中串联 sync-skill-updaters --check。
- 后续正文核对与局限：后续正文更新 sourcePath/发布细节；完整模板、生成器、产物和 check 的历史证据不依赖后续状态。

#### `260701-gate-latest-release-by-skill-hash` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260701-gate-latest-release-by-skill-hash.md`；修复前 SHA-256：`7f2ef896d1c4a8657faac38318b490c1ed10d40859073f380e873ad26921e651`。
- 历史核对：`328bc9596924e7158d846f1710b1c4d07c10453b:docs/decisions/project-tooling/260701-amended-gate-latest-release-by-skill-hash.md`。
- 完整采用方向：以 skill-package.hash 和稳定的全 skill 路径/字节 SHA-256 判断发布，只有 hash 改变时更新 latest，成功后 CI 写回基线。
- 区分性依据：
  - `328bc9596924e7158d846f1710b1c4d07c10453b:scripts/lib/skill-package-hash.ts`：实现按已发现 skill 和排序后的文件路径、字节长度、字节内容写入 SHA-256。
  - `328bc9596924e7158d846f1710b1c4d07c10453b:scripts/hash-skills.ts`：实现当前/记录 hash 比较、GitHub outputs 和 --check/--write。
  - `328bc9596924e7158d846f1710b1c4d07c10453b:scripts/lib/project.ts`：skill discovery 与 collectSkillFiles 对目录条目排序；它是 hash-skills 复用的稳定输入枚举。
  - `328bc9596924e7158d846f1710b1c4d07c10453b:.github/workflows/package-skills.yml`：workflow 从 github.event.before 读旧 hash，publish 只在 skill_hash_changed=true 时运行，并在发布后写回并提交 hash。
- 后续正文核对与局限：后续正文把 release 版本化并最终转为其他模型；该历史 revision 的 hash 门禁和写回路径可直接核对。

#### `260710-use-cli-active-index-and-invalidated-archive` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260710-use-cli-active-index-and-invalidated-archive.md`；修复前 SHA-256：`13e2706f3b2c92b07e30f2627aa9e638b21a35ccf36a1c05221964346ed90eb8`。
- 历史核对：`be9323c99d297e105f1c45017238a8528197e6bc:docs/decisions/decision-records-skill/260710-active-use-cli-active-index-and-invalidated-archive.md`。
- 完整采用方向：提供默认只读 check、active 默认 list、仅 --write 的 sync-index；保留历史，规定 invalidated 的 archive 位置但不自动移动。
- 区分性依据：
  - `be9323c99d297e105f1c45017238a8528197e6bc:skills/decision-records/scripts/decision-records.mjs`：usage 和参数解析仅有 check/list/sync-index；list 默认 active，--write 仅允许 sync-index。
  - `be9323c99d297e105f1c45017238a8528197e6bc:skills/decision-records/scripts/decision-records.mjs`：scan 验证 invalidated 必在 archive/<impact-area>、archive 不得含其他状态；没有 archive mutation 命令。
  - `be9323c99d297e105f1c45017238a8528197e6bc:skills/decision-records/references/decision-record-rules.md`：契约将 active 索引、显式历史查询、保留记录和 invalidated 归档位置写为维护规则。
- 后续正文核对与局限：后续生命周期模型替换文件名状态体系；没有把此时已实现的命令边界作为后继实现证据。

#### `260711-bound-history-with-direct-relations` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260711-bound-history-with-direct-relations.md`；修复前 SHA-256：`ea1319ac87859b290737b8479197c82eff3656cad6eba06f06650a728bedf446`。
- 历史核对：`1e0fbb27be2a9a6d418c62cc8bdf61728e85181d:docs/decisions/decision-records/260711-active-bound-history-with-direct-relations.md`。
- 完整采用方向：新 active 决策仅链接直接前序、独立写完整当前结论；历史过长时用归并决策建立日常读取终点。
- 区分性依据：
  - `1e0fbb27be2a9a6d418c62cc8bdf61728e85181d:docs/decisions/decision-records/260711-active-bound-history-with-direct-relations.md`：完整 active 正文规定直接关系、独立结论、归并和不删除祖先。
  - `1e0fbb27be2a9a6d418c62cc8bdf61728e85181d:skills/decision-records/references/decision-record-rules.md`：关系与读取边界实际定义四类直接关系、双向导航、归并终点和无关系时省略。
  - `1e0fbb27be2a9a6d418c62cc8bdf61728e85181d:skills/decision-records/references/decision-record-rules.md`：维护事务要求修订/归并时写完整当前结论、只链接直接前序并同步索引。
- 后续正文核对与局限：后续 relation 表达改为 frontmatter；这里的完整 Markdown 关系方向在该历史 revision 已有明确规则实现。

#### `260711-repair-noncanonical-decision-formats` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260711-repair-noncanonical-decision-formats.md`；修复前 SHA-256：`41cc5164f790944d1ad5d624c84893609534c3db45f39f6856f05990c330094d`。
- 历史核对：`1e0fbb27be2a9a6d418c62cc8bdf61728e85181d:docs/decisions/decision-records-skill/260711-active-repair-noncanonical-decision-formats.md`。
- 完整采用方向：把非标准材料在授权维护时收敛为 bundled 唯一契约，保留可确认语义；信息不足且会改变含义时才询问，纯只读任务不写。
- 区分性依据：
  - `1e0fbb27be2a9a6d418c62cc8bdf61728e85181d:docs/decisions/decision-records-skill/260711-active-repair-noncanonical-decision-formats.md`：完整 active 正文规定唯一目标格式、可自主确定的映射和只读报告边界。
  - `1e0fbb27be2a9a6d418c62cc8bdf61728e85181d:skills/decision-records/references/decision-record-rules.md`：“修复非标准格式”事务列出清点、语义映射、关系/链接恢复、索引同步和仅在改变含义时询问。
  - `1e0fbb27be2a9a6d418c62cc8bdf61728e85181d:skills/decision-records/SKILL.md`：历史 skill 的识别与维护流程将非标准输入收敛到固定契约，而不是维护兼容分支。
- 后续正文核对与局限：后续记录改写了确认授权规则；未发现它否定当时已写入 skill/reference 的唯一契约与只读边界。

#### `260711-require-confirmed-decision-writes` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260711-require-confirmed-decision-writes.md`；修复前 SHA-256：`0aeb5cd951c6c5a740273964a2173f0d7d3f88acb7c6c40e102ad9ed74b1f1e3`。
- 历史核对：`929c861d296555e615eae2becf15f5fe667a9b73:docs/decisions/decision-records-skill/260711-active-require-confirmed-decision-writes.md`。
- 完整采用方向：仅在自然阶段提出有长期价值的候选；用户明确记录即构成确认；非标准格式先只读报告，取得明确修复范围后才写。
- 区分性依据：
  - `929c861d296555e615eae2becf15f5fe667a9b73:docs/decisions/decision-records-skill/260711-active-require-confirmed-decision-writes.md`：完整 active 正文列出候选概览、确认复用、局部例外不写和非标准格式的显式修复边界。
  - `929c861d296555e615eae2becf15f5fe667a9b73:skills/decision-records/SKILL.md`：执行流程逐项实现只读恢复、明确记录确认、候选概览、确认前保持只读和确认后修复。
  - `929c861d296555e615eae2becf15f5fe667a9b73:scripts/decision-records/tests/run.ts`：测试在复制 contract 到项目决策根时断言 validator 报 root contains unsupported file，支持唯一 bundled contract 边界。
- 后续正文核对与局限：后续 active/archived body 的确认表述发生演进；本结论只针对 929 的完整 skill/reference 行为。

#### `260711-separate-skill-script-source-and-generated-artifacts` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260711-separate-skill-script-source-and-generated-artifacts.md`；修复前 SHA-256：`e8d8bb17529da3f4108b4541c73bafa5029ac4a8c5e7b55236c06cd84fa08c65`。
- 历史核对：`b38300ded226e7c82408b151c0a2e950ca109888:docs/decisions/project-tooling/260711-active-separate-skill-script-source-and-generated-artifacts.md`。
- 完整采用方向：在 scripts 下维护 TypeScript 源码、构建与测试，在 skill 下提交可直接执行的确定性生成物；同步/检查防漂移并通过生成头可追溯。
- 区分性依据：
  - `b38300ded226e7c82408b151c0a2e950ca109888:scripts/decision-records/build.ts`：构建器以 scripts/decision-records/src/cli.ts 生成 skills/decision-records/scripts/decision-records.mjs，check 仅比较、write 才更新。
  - `b38300ded226e7c82408b151c0a2e950ca109888:skills/decision-records/scripts/decision-records.mjs`：已提交产物头同时给出禁止直接编辑、仓库、源码 URL/path、skill 目录和 rebuild 命令。
  - `b38300ded226e7c82408b151c0a2e950ca109888:scripts/decision-records/tests/run.ts`：测试以生成 CLI 路径运行 Node 分发产物，并引用源码/生成物检查。
- 后续正文核对与局限：后续工具目录和生成格式演进，但未作为本历史对齐的依据；该 revision 已可逐项核对源码、产物和测试入口。

#### `260711-use-bundled-contract-owner` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260711-use-bundled-contract-owner.md`；修复前 SHA-256：`d94c29fd2a48a467773298e4cdc94cd2d059b53810239d52d767e5b2c2b3521f`。
- 历史核对：`929c861d296555e615eae2becf15f5fe667a9b73:docs/decisions/decision-records/260711-active-use-bundled-contract-owner.md`。
- 完整采用方向：由随包 decision-record-rules 唯一承接固定契约；项目根仅保存索引与实际决策，项目专属门槛另在 AGENTS/行为 owner，校验拒绝 contract 副本。
- 区分性依据：
  - `929c861d296555e615eae2becf15f5fe667a9b73:skills/decision-records/SKILL.md`：Owner 与读取将 bundled rules 标为唯一固定契约，目标 docs/decisions 只存索引和实际决策。
  - `929c861d296555e615eae2becf15f5fe667a9b73:skills/decision-records/references/decision-record-rules.md`：reference 独立定义目录、状态、关系、正文、索引和维护事务，作为固定契约。
  - `929c861d296555e615eae2becf15f5fe667a9b73:skills/decision-records/scripts/decision-records.mjs`：扫描器的 requiredRootFiles 仅含 decision-record-index.md，根目录其他文件报 unsupported，直接实现不接受项目契约副本。
- 后续正文核对与局限：6cdf156 将索引从 Markdown 迁至 JSON，当前归档正文随之改写；这不改变 929 时唯一 bundled contract 的已实现方向。

#### `260720-use-filtered-decision-queries` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-use-filtered-decision-queries.md`；修复前 SHA-256：`79f98f1a3a2613ca7a30737130725eb30906d1c951654e4b893d6c3544dfbd39`。
- 历史核对：`2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:docs/decisions/decision-records/260720-use-filtered-decision-queries.md`。
- 完整采用方向：list 默认只查 active、可按状态筛选并展示索引投影；show 展开正文，trace 回放有方向和深度的关系。
- 区分性依据：
  - `d78ac9f34a15d668b3f315e14633169f10769f1a:docs/decisions/decision-records/260720-use-filtered-decision-queries.md`：原始完整决策给出 list/show/trace 的分工、默认 active 和状态筛选方向。
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:scripts/decision-records/src/cli.ts; scripts/decision-records/tests/queries.test.ts`：实现查询命令；测试分别断言默认 active、--status archived/all、show 元数据和带方向 trace。
- 后续正文核对与局限：复核 d78 至 169d74e^ 的同一记录演变：后续为 frontmatter/lifecycle 与路径元数据迁移，未发现替换该查询分工的正文方向。

#### `260720-use-lifecycle-index-and-semantic-paths` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-use-lifecycle-index-and-semantic-paths.md`；修复前 SHA-256：`8eea311eb593f9f9fb0ad2b2b4498c3cf64ce063075dffdc12eb13cc927bce38`。
- 历史核对：`2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:docs/decisions/decision-records/260720-use-lifecycle-index-and-semantic-paths.md`。
- 完整采用方向：以语义路径而非日期定位决策，并以全生命周期单一索引保存状态、秒级时间、摘要投影和直接关系。
- 区分性依据：
  - `d78ac9f34a15d668b3f315e14633169f10769f1a:docs/decisions/decision-records/260720-use-lifecycle-index-and-semantic-paths.md`：原始正文完整说明语义路径和覆盖活动/归档记录的索引投影。
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:scripts/decision-records/src/decision-index.ts; scripts/decision-records/src/decision-path.ts; scripts/decision-records/tests/queries.test.ts`：代码生成全记录索引并使用语义路径；查询测试覆盖 active/archived/all 和 topic 路径筛选。
- 后续正文核对与局限：复核 d78 至 169d74e^：正文方向未被后继文本替换，变化为生命周期字段、投影格式和后续身份迁移。

#### `260720-use-product-and-architecture-lenses` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260720-use-product-and-architecture-lenses.md`；修复前 SHA-256：`96002515ae1cbcac59fe39e8366c361cd062a766d61d986c96b273a81a3e86ec`。
- 历史核对：`f5754c8e9798ca90a6c2ae847fb09253ba8892f9:docs/decisions/product-architecture-thinking-behavior/260720-use-product-and-architecture-lenses.md`。
- 完整采用方向：以独立 skill 让工程判断先确认产品结果和架构责任，再选择最小技术动作；不保留独立 code-review 包装。
- 区分性依据：
  - `f5754c8e9798ca90a6c2ae847fb09253ba8892f9:docs/decisions/product-architecture-thinking-behavior/260720-use-product-and-architecture-lenses.md`：完整决策列出产品/架构视角、任务边界及移除 review wrapper 的采用与不采用项。
  - `f5754c8e9798ca90a6c2ae847fb09253ba8892f9:skills/product-architecture-thinking/SKILL.md; skills/code-review/SKILL.md`：同次提交新增独立 skill，入口逐段落实产品、架构、技术动作和任务出口；同时删除旧 code-review skill。
- 后续正文核对与局限：沿文件历史复核至 169d74e^：后续仅登记为 archived 和身份/路径迁移，没有改写该完整采用方向。

#### `260721-separate-test-entry-collection-from-ledger` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260721-separate-test-entry-collection-from-ledger.md`；修复前 SHA-256：`e6f18fb1ec186a42228086a1d059b9beb85918651eb8c5916ef1afcbb3109b11`。
- 历史核对：`143adb7a436344b9e67ce4362d138761bd4c18c2:docs/decisions/test-evidence-review-behavior/260721-separate-test-entry-collection-from-ledger.md`。
- 完整采用方向：以版本化清单和 Schema 分离可替换入口采集层与只消费清单的账本层，保留组合兼容入口和结构化诊断。
- 区分性依据：
  - `143adb7a436344b9e67ce4362d138761bd4c18c2:docs/decisions/test-evidence-review-behavior/260721-separate-test-entry-collection-from-ledger.md`：完整正文明确 collector/ledger、Schema 真源、兼容入口与诊断 blocking 语义。
  - `143adb7a436344b9e67ce4362d138761bd4c18c2:scripts/test-evidence/src/regex-collector.ts; scripts/test-evidence/src/ledger-cli.ts; scripts/test-evidence/src/schemas.ts; scripts/test-evidence/tests/run.ts`：同次实现独立 collector、仅接收 inventory 的 ledger 和 Schema；测试把外部 AST inventory 传给 ledger，并断言 schema-invalid 和 CLI inventory 路径。
- 后续正文核对与局限：复核至 169d74e^：记录正文未被实质改写；后续为决策模型/归档路径迁移。

#### `append-self-contained-investigation-reports` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/append-self-contained-investigation-reports.md`；修复前 SHA-256：`317b77a2be9f89192504028d53cec54b7c20e9e857e107affffa47512cc8d46c`。
- 历史核对：`59181282d1718244cd57d4e0af825a997d2c1e8e:docs/decisions/investigation-report-behavior/append-self-contained-investigation-reports.md`。
- 完整采用方向：一个稳定主题文件按实质认识更新追加可独立阅读的完整报告，每份固定含背景、起因和调查结果，最新报告承接当前口径。
- 区分性依据：
  - `59181282d1718244cd57d4e0af825a997d2c1e8e:docs/decisions/investigation-report-behavior/append-self-contained-investigation-reports.md`：完整决策定义主题、追加、三项核心章节、最新报告 owner、可选支撑和检查边界。
  - `59181282d1718244cd57d4e0af825a997d2c1e8e:scripts/investigation-report/src/markdown.ts; scripts/investigation-report/src/validation.ts; scripts/investigation-report/tests/run.ts`：同次重写报告生成/校验；测试覆盖三项核心章节的存在、非空、唯一和顺序。
- 后续正文核对与局限：复核至 169d74e^：其后演进由独立后继记录表达，原记录正文没有被倒改为另一方向。

#### `converge-records-before-stable-baseline` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/converge-records-before-stable-baseline.md`；修复前 SHA-256：`1b581d16a210548e35f3e633ef70ea97e671ad3552c1c992a2f48ae7fa59b02f`。
- 历史核对：`11a21df716927050be437f6f9509240b60abd485:docs/decisions/decision-records/converge-records-before-stable-baseline.md`。
- 完整采用方向：已进入稳定基线或被依赖的记录以独立后继演进；同一事务中新建且未建立的记录可在原路径收敛。
- 区分性依据：
  - `11a21df716927050be437f6f9509240b60abd485:docs/decisions/decision-records/converge-records-before-stable-baseline.md`：完整正文给出已建立与未建立的划分，以及原地收敛的条件和边界。
  - `11a21df716927050be437f6f9509240b60abd485:skills/decision-records/references/decision-record-rules.md; skills/decision-records/SKILL.md`：同次把稳定基线/依赖条件和候选原地收敛规则写入行为入口及权威规则 owner。
- 后续正文核对与局限：复核至 169d74e^：仅见记录格式、生命周期及路径迁移，未发现撤回这项已写入规则 owner 的方向。

#### `define-decision-alignment-semantics` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/define-decision-alignment-semantics.md`；修复前 SHA-256：`01ee324881f0f7cecf2723b04deb77c3728c4da1c67987d3eaa174f257c5876f`。
- 历史核对：`3a124c45cd1824e7d3155fcc628e190d6f6e20cf:docs/decisions/decision-records/define-decision-alignment-semantics.md`。
- 完整采用方向：活动决策用 aligned/unaligned 表达完整方向相对于事实的状态；unaligned 仍是有效约束而非自由空间。
- 区分性依据：
  - `9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/define-decision-alignment-semantics.md`：原始完整正文定义生命周期与对齐分离、aligned 的完整事实门槛及 unaligned 的限制。
  - `3a124c45cd1824e7d3155fcc628e190d6f6e20cf:scripts/decision-records/src/decision-metadata.ts; skills/decision-records/references/decision-record-rules.md; scripts/decision-records/tests/run.ts`：同次实现 alignment 元数据和生命周期校验；测试拒绝 active/null 并验证 unaligned 不能回退及索引投影。
- 后续正文核对与局限：复核计划记录与 3a 实施后的文本至 169d74e^：只发生结构/归档迁移，无相反语义。

#### `derive-pending-from-head-path` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/derive-pending-from-head-path.md`；修复前 SHA-256：`63615f315bfb3fcef01aaae90498a767e7325207e655e0d80d050b82c67fb775`。
- 历史核对：`816349a7fb232da4b59afa63a07d2b7de5fd3b97:docs/decisions/decision-records/derive-pending-from-head-path.md`。
- 完整采用方向：始终查询当前 Markdown/索引；仅以路径是否存在于 HEAD 临时派生 pending，不持久化草稿状态或读取第二份 HEAD 视图。
- 区分性依据：
  - `816349a7fb232da4b59afa63a07d2b7de5fd3b97:docs/decisions/decision-records/derive-pending-from-head-path.md`：完整决策给出 HEAD 读取边界、unborn HEAD 条件和禁止第二份历史视图。
  - `816349a7fb232da4b59afa63a07d2b7de5fd3b97:scripts/decision-records/src/head-decision-paths.ts; scripts/decision-records/src/cli.ts; scripts/decision-records/tests/head-presence.test.ts`：同次实现 HEAD 路径收集和查询/写命令的 pending 标记；专项测试覆盖路径存在、错误与首次提交边界。
- 后续正文核对与局限：复核至 169d74e^：正文方向未实质改变，后续仅改写记录模型和归档位置。

#### `establish-decisions-with-atomic-evolution` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/establish-decisions-with-atomic-evolution.md`；修复前 SHA-256：`f5c7b25443fef6a2a432b432071db05910c7be4100946a4b2aaf04180f6a3a6e`。
- 历史核对：`ddaae930689ff408f1453802e6c3d2a75710d3fe:docs/decisions/decision-records/establish-decisions-with-atomic-evolution.md`。
- 完整采用方向：以自包含 Markdown 生命周期建立记录；普通 activate 只建立目标，evolve 原子归档完整前序、写关系、激活候选并重建索引。
- 区分性依据：
  - `ddaae930689ff408f1453802e6c3d2a75710d3fe:docs/decisions/decision-records/establish-decisions-with-atomic-evolution.md`：完整决策逐项定义候选/已建立、activate/evolve、完整关系、索引派生与失败恢复。
  - `ddaae930689ff408f1453802e6c3d2a75710d3fe:tools/decision-records/src/cli.ts; tools/decision-records/tests/lifecycle-establishment.test.ts`：同次实现生命周期和演进事务；专项测试验证建立、关系和原子失败/恢复约束。
- 后续正文核对与局限：该记录首次建立即含完整实现；后续至 169d74e^ 未发现正文采用方向被改写，只发生归档/模型迁移。

#### `express-decision-alignment-state` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/express-decision-alignment-state.md`；修复前 SHA-256：`bc0276f067d97199b96a3640d5b444f5d3a9d045af0e1289804f0523990ac15f`。
- 历史核对：`3a124c45cd1824e7d3155fcc628e190d6f6e20cf:docs/decisions/decision-records/express-decision-alignment-state.md`。
- 完整采用方向：决策格式必须独立于生命周期表达对齐状态，并由索引投影支持筛选与校验。
- 区分性依据：
  - `d57fb4c44b4baf0d9c53756895f991aede085194:docs/decisions/decision-records/express-decision-alignment-state.md`：原始完整正文说明对齐状态与生命周期分离以及索引投影用途。
  - `3a124c45cd1824e7d3155fcc628e190d6f6e20cf:scripts/decision-records/src/decision-metadata.ts; scripts/decision-records/tests/run.ts`：实现 alignment 字段和索引投影；测试验证 active 记录不可为 null、归档和激活状态的投影。
- 后续正文核对与局限：复核 d57 至 169d74e^：后续没有将该格式方向替换为其他机制。

#### `index-independent-proof-cases-from-current-catalog` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/index-independent-proof-cases-from-current-catalog.md`；修复前 SHA-256：`73d7f41401d8d49ef70ca3abe4be4da0acd2d51f8765287436ce3cca20339fa8`。
- 历史核对：`efd1a3fadbac34b39034ec6aa255cd5d0a73246c:docs/decisions/test-evidence-review/index-independent-proof-cases-from-current-catalog.md`。
- 完整采用方向：case 是可长期找回的独立证明单元；索引搜索完整 Contract/Proves/Entry，索引异常时只读从当前合法 Markdown 建内存投影，严格 check 仍要求索引新鲜。
- 区分性依据：
  - `efd1a3fadbac34b39034ec6aa255cd5d0a73246c:docs/decisions/test-evidence-review/index-independent-proof-cases-from-current-catalog.md`：完整正文定义独立 case 边界、完整搜索文本、只读内存降级和严格同步边界。
  - `efd1a3fadbac34b39034ec6aa255cd5d0a73246c:tools/verification-evidence/src/query.ts; tools/verification-evidence/tests/run.ts`：query 在索引异常时明确用当前 catalog 的内存投影且不写入；测试覆盖 Contract/Proves 搜索、show 和 stale-index 降级查询。
- 后续正文核对与局限：记录的首个可见版本就是此实现提交且为 archived/null；该结论仅据同一 revision 的完整正文、代码和测试证明历史方向已经落地，不以归档字段本身推断。

#### `package-index-json-schema` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/package-index-json-schema.md`；修复前 SHA-256：`c5197aab69d4359c1513e7ca81b088d9f5fad743d9722b5c7cae6b142fa3854c`。
- 历史核对：`c666e5ae621f660bc22d7de7e849245713dd4b9e:docs/decisions/decision-records/package-index-json-schema.md`。
- 完整采用方向：在 decision-records 源码维护 JSON Schema 生成对象，确定性生成随 skill 分发的 Schema；字段格式由 Schema，集合语义由固定契约和 check 承接。
- 区分性依据：
  - `c666e5ae621f660bc22d7de7e849245713dd4b9e:docs/decisions/decision-records/package-index-json-schema.md`：完整正文界定源码 owner、分发产物、恢复用途和 Schema/集合语义的边界。
  - `c666e5ae621f660bc22d7de7e849245713dd4b9e:scripts/decision-records/src/decision-index-json-schema.ts; scripts/decision-records/build.ts; scripts/decision-records/tests/generated-artifacts.test.ts`：同次新增 schema 生成器并写入 skill references；测试将分发 JSON 与源码对象比较并断言必填字段。
- 后续正文核对与局限：复核至 169d74e^：后续 schema/version 演进未倒改该 owner 和生成分发方向。

#### `query-ledger-with-structured-inspection` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/query-ledger-with-structured-inspection.md`；修复前 SHA-256：`27197cd96098cb15b7a9118efd9ac146ce66e3145e72956e490629d028c0f5d2`。
- 历史核对：`143adb7a436344b9e67ce4362d138761bd4c18c2:docs/decisions/test-evidence-review-behavior/query-ledger-with-structured-inspection.md`。
- 完整采用方向：严格 check 与可恢复 list/show 分离；提供 inspection、版本化结果和结构化 diagnostics，查询可报告 incomplete 而不替代严格验证。
- 区分性依据：
  - `143adb7a436344b9e67ce4362d138761bd4c18c2:docs/decisions/test-evidence-review-behavior/query-ledger-with-structured-inspection.md`：完整正文定义 check/list/show、筛选、inspection、schemaVersion 与诊断边界。
  - `143adb7a436344b9e67ce4362d138761bd4c18c2:scripts/test-evidence/src/inspection.ts; scripts/test-evidence/src/ledger-cli.ts; scripts/test-evidence/tests/run.ts`：同次实现 inspection 视图和 ledger list/show；测试断言 inspection 的 case/entry 视图、list/show 输出和 incomplete/schemaVersion。
- 后续正文核对与局限：复核至 169d74e^：没有发现改写该读侧/严格校验分离的正文方向。

#### `support-degraded-decision-maintenance` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/support-degraded-decision-maintenance.md`；修复前 SHA-256：`81a0e6678e915dc71b06b43fe67ca1125eaf4a35fc3bc1c2a201b872269ae272`。
- 历史核对：`c666e5ae621f660bc22d7de7e849245713dd4b9e:docs/decisions/decision-records/support-degraded-decision-maintenance.md`。
- 完整采用方向：维护仅在异常时读取的恢复手册，按可用条件恢复运行时或做受限、可追踪的降级维护，恢复后回到严格 check。
- 区分性依据：
  - `c666e5ae621f660bc22d7de7e849245713dd4b9e:docs/decisions/decision-records/support-degraded-decision-maintenance.md`：完整正文规定异常触发、替代运行时/源码/最小工具、候选索引和恢复后 check 的边界。
  - `c666e5ae621f660bc22d7de7e849245713dd4b9e:skills/decision-records/references/maintenance-recovery.md; scripts/decision-records/build.ts; scripts/decision-records/tests/generated-artifacts.test.ts`：同次提供分故障恢复路径及构建分发资源；生成产物测试验证恢复所依赖的 CLI、声明、Schema 和 source map。
- 后续正文核对与局限：复核至 169d74e^：后续契约重构没有撤销“异常按需读取、先保留证据、再严格校验”的方向。

#### `use-alignment-aware-decision-commands` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/use-alignment-aware-decision-commands.md`；修复前 SHA-256：`b60dd09050a136605078594eb9cbd951e1451bd4bc2fe58f43eb0900fcb909b3`。
- 历史核对：`3a124c45cd1824e7d3155fcc628e190d6f6e20cf:docs/decisions/decision-records/use-alignment-aware-decision-commands.md`。
- 完整采用方向：activate 显式选择 alignment，mark-aligned 仅完成 unaligned→aligned，list 可筛选对齐；关系不隐式改变状态。
- 区分性依据：
  - `9cb979ef65553ad900c1717a0f56d66af27ef769:docs/decisions/decision-records/use-alignment-aware-decision-commands.md`：原始正文完整定义命令参数、单向标记、查询展示与关系边界。
  - `3a124c45cd1824e7d3155fcc628e190d6f6e20cf:scripts/decision-records/src/cli.ts; scripts/decision-records/src/decision-transaction.ts; scripts/decision-records/tests/run.ts`：实现对齐感知 activate/list/事务；测试覆盖显式 alignment、拒绝 rollback、归档/激活和索引投影。
- 后续正文核对与局限：复核计划到 3a 实施及其后归档迁移，未见同一记录的相反命令语义。

#### `use-error-recovery-reference` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/use-error-recovery-reference.md`；修复前 SHA-256：`d4d3f62f70d55d38defdce72bb2067b90d14e5888bfcc1888026931b5790099d`。
- 历史核对：`2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:docs/decisions/decision-records/use-error-recovery-reference.md`。
- 完整采用方向：维护按需读取的恢复手册，冷启动、索引或运行时故障时先保留 Git/Markdown 证据，再按分类恢复，出口为严格 check。
- 区分性依据：
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:docs/decisions/decision-records/use-error-recovery-reference.md`：完整正文给出触发条件、证据优先、故障分类、v2→v3 升级和 check 出口。
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:skills/decision-records/references/maintenance-recovery.md; scripts/decision-records/src/cli.ts`：同次新增可执行的恢复手册，覆盖冷启动、索引重建、缺失成员和运行时不可用，并由 CLI 的 check/sync-index 路径承接恢复出口。
- 后续正文核对与局限：复核至 169d74e^：后续恢复文档扩充而非撤销按需入口和证据优先边界。

#### `use-report-oriented-investigation-rounds` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/use-report-oriented-investigation-rounds.md`；修复前 SHA-256：`c3f70b654bb70b71c7633cfbd8e2a29e09f0b13f7c23f623817b0d7e3a4c9b1e`。
- 历史核对：`c53b984f31d120cc87e1b2c06c4f791ecc731b59:docs/decisions/investigation-report-behavior/use-report-oriented-investigation-rounds.md`。
- 完整采用方向：只在用户明确要求沉淀时启用调查报告 skill；以可接续调查段、顶部当前概述、语义路径和检查器保留多轮调查。
- 区分性依据：
  - `c53b984f31d120cc87e1b2c06c4f791ecc731b59:docs/decisions/investigation-report-behavior/use-report-oriented-investigation-rounds.md`：完整正文给出触发边界、报告段、概述/时间/路径格式与不扩张为通用调查路由的限制。
  - `c53b984f31d120cc87e1b2c06c4f791ecc731b59:skills/investigation-report/SKILL.md; scripts/investigation-report/src/validation.ts; scripts/investigation-report/tests/run.ts`：同次新增 skill、报告校验器和完整测试；测试构造并校验调查信息、调查段及时间/结构约束。
- 后续正文核对与局限：其后 append-self-contained-investigation-reports 以显式替代关系演进；按单向历史语义，该后继不抹除 c53 已实现并验证的对齐事实。

#### `use-second-precision-lifecycle-index` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/use-second-precision-lifecycle-index.md`；修复前 SHA-256：`bd442585e553fb069bdb5af44199c30a8228d7384906ef0574b87dcc9a3a5066`。
- 历史核对：`2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:docs/decisions/decision-records/use-second-precision-lifecycle-index.md`。
- 完整采用方向：使用语义路径和全生命周期 schema v3 索引；createdAt 为秒级，新记录取激活时间，旧记录优先从最早 Git 作者时间恢复。
- 区分性依据：
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:docs/decisions/decision-records/use-second-precision-lifecycle-index.md`：完整正文说明语义身份、全生命周期投影、时间证据优先级和首条激活边界。
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:scripts/decision-records/src/decision-index.ts; scripts/decision-records/src/record.ts; scripts/decision-records/tests/queries.test.ts`：同次实现 records 生命周期投影和 createdAt 处理；测试读写活动/归档成员、全时间输出和索引校验。
- 后续正文核对与局限：复核至 169d74e^：后续 metadata 迁移未否定秒级生命周期索引的历史实现。

#### `use-topic-filtered-decision-queries` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/use-topic-filtered-decision-queries.md`；修复前 SHA-256：`be6c753e98d069e2795aa541ee9779605ffa767c897682ea39141501080f7f7c`。
- 历史核对：`2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:docs/decisions/decision-records/use-topic-filtered-decision-queries.md`。
- 完整采用方向：list 默认 active，并可组合 --topic、状态和 full-time；show 展开正文，trace 回放关系。
- 区分性依据：
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:docs/decisions/decision-records/use-topic-filtered-decision-queries.md`：完整正文定义主题取路径第一段、与状态/时间的组合和空结果行为。
  - `2e1f68c4cf4926b32fe29f6fcc7115d4246cb09d:scripts/decision-records/src/cli-args.ts; scripts/decision-records/src/cli.ts; scripts/decision-records/tests/queries.test.ts`：同次实现 topic/status/full-time 参数；测试断言 topic+all、合法空 topic、默认 active 和错误旧参数。
- 后续正文核对与局限：复核至 169d74e^：未发现该查询方向被正文改写，后续只是决策记录身份和归档布局迁移。

#### `260630-name-decision-root-docs-by-owner` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260630-name-decision-root-docs-by-owner.md`；修复前 SHA-256：`fdd40dde69568ca973c1eb9e3050e711257419f51314877dee69bdcef6216336`。
- 历史核对：`f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-records/260630-active-name-decision-root-docs-by-owner.md`。
- 完整采用方向：用显式的 decision-record-index.md 与 decision-record-rules.md 分别承接导航和规则，并校验非 active 状态来源链接。
- 区分性依据：
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-records/260630-active-name-decision-root-docs-by-owner.md`：该完整 active 正文与 fd256838 同路径 blob 完全相同（blob 8628d3de…）；它明确采用两个 owner 和验证非 active 状态来源链接。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-record-index.md`：实际文件声明自己只承接影响面、状态速查和决策链接，并指向规则 owner。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:docs/decisions/decision-record-rules.md`：实际文件承接门槛、命名、状态关系、正文结构与更新流程，排除索引职责。
  - `f3eb02e0ba63ca108f85346ce33c9b7fa302f736:scripts/validate-decisions.ts`：同一 tree 的 validator 定义四种状态，并校验 non-active 状态来源是现有 impact-area 决策路径。
- 后续正文核对与局限：fd256838 的决策 Markdown 是同一 blob 8628d3de…，但其 tree 尚无 validator；以 f3eb02e 的同 blob、同路径完整 tree 作为可证明完成 revision。后续归档正文没有新增未实现的完整方向。

#### `260630-merge-prompt-optimize-core-flow-into-entry` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260630-merge-prompt-optimize-core-flow-into-entry.md`；修复前 SHA-256：`4389a85bc734ee03adc034816b5b7c109df7df1ac66a2907a3548abd0ff4ff93`。
- 历史核对：`4acffff64c9fe80cf18f11d460afab0276c73fe5:docs/decisions/skill-references/2026-06-30-merge-core-flow-into-entry.md`。
- 完整采用方向：让 prompt-optimize 的 SKILL.md 直接承接完整默认执行路径，只主动引用 principles.md 和 agent-tasks.md；workflows.md 与 rewrite-rules.md 作为写明迁移状态的非主动保留副本。
- 区分性依据：
  - `4acffff64c9fe80cf18f11d460afab0276c73fe5:docs/decisions/skill-references/2026-06-30-merge-core-flow-into-entry.md`：原始决策与实现同提交形成；验证段逐项确认入口已吸收主干、运行路径不再主动引用两份副本、副本已有迁移说明，并记录 pnpm run check 验证。
  - `4acffff64c9fe80cf18f11d460afab0276c73fe5:skills/prompt-optimize/SKILL.md`：子模块化前的完整同仓树可直接读取：入口包含目标、两项主动引用、九步主执行流程、模式分流、冲突、交付与完成检查，完整承接决策列出的默认路径。
  - `4acffff64c9fe80cf18f11d460afab0276c73fe5:skills/prompt-optimize/references/workflows.md`：文件首段明确它是合并默认工作流后的迁移保留副本、当前不再作为主动读取入口、仅供回溯旧结构。
  - `4acffff64c9fe80cf18f11d460afab0276c73fe5:skills/prompt-optimize/references/rewrite-rules.md`：文件首段以相同方式标记改写管线为迁移保留副本；正文仍完整保留旧八步规则，满足保留而非删除的方向。
- 后续正文核对与局限：22b9c570364cdb4783c46605fe234ac7fa7b8c73 后继将该记录改为 amended，只改变入口细则展开程度和副本位置；它明确保留 SKILL.md 为默认路径 owner。313701a1f738d5322e9371093061278ea0dc6870 随后把副本移入 archive。后期修订不撤销 4acffff 时已经完整实现并核对的单向历史基线。

#### `260710-use-explicit-portable-decision-memory` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/260710-use-explicit-portable-decision-memory.md`；修复前 SHA-256：`eb8b4b2b9c25b437241c4b63a9a508ae8a94470815bccb6dc0f5db7e675fa973`。
- 历史核对：`be9323c99d297e105f1c45017238a8528197e6bc:docs/decisions/decision-records-skill/260710-amended-use-explicit-portable-decision-memory.md`。
- 完整采用方向：以目标项目公开、可版本化的 docs/decisions Markdown 固定协议作为长期记忆 data owner；skill 承接通用语义和格式，只读校验器检查结构，不建立隐藏状态或自动修复。
- 区分性依据：
  - `be9323c99d297e105f1c45017238a8528197e6bc:docs/decisions/decision-records-skill/260710-amended-use-explicit-portable-decision-memory.md`：首次提交的旧记录虽已 amended，但完整保留原方向与验证：通用 skill、固定规则 reference、无依赖只读 validate-decisions.mjs，并明确记载校验器已通过本仓库和归档中的另一套真实决策目录。
  - `be9323c99d297e105f1c45017238a8528197e6bc:docs/decisions/decision-records-skill/260710-active-use-cli-active-index-and-invalidated-archive.md`：同次后继的决策过程明确回放时间顺序：初版脚本只提供只读结构检查，之后用户才要求 CLI、索引同步和归档；它正面证明只读阶段存在，而不是从当前可写 CLI 反推。
  - `d15ee9ab6e4157a7e1f8a29aa91fc6eb5a4ef7f5:scripts/validate-decisions.ts`：直接父树的命令入口只调用 validateDecisionRecords 并输出诊断，没有写入命令。
  - `d15ee9ab6e4157a7e1f8a29aa91fc6eb5a4ef7f5:scripts/validators/decision-records.ts`：直接父树的校验实现只读取索引与决策 Markdown 并返回错误，提供原方向所复用的第一套真实项目机制。
  - `be9323c99d297e105f1c45017238a8528197e6bc:skills/decision-records/references/archive/wsl/docs/decisions/decision-record-rules.md`：提交内保留第二个真实项目的公开 Markdown 契约、索引与决策样本，佐证固定协议跨项目使用及目标项目拥有数据的边界。
- 后续正文核对与局限：be9323 的后继已明确把脚本只读、全状态索引和 invalidated 位置标为被修订部分，同时明确显式可移植记忆、目标项目 data owner 与 skill 语义判断仍有效。可写 CLI 是后续偏离，不撤销记录所明载且已验证的初版完整方向。

#### `preserve-comparable-investigation-inputs` — `alignment: unaligned`

- 主审批准的最终值：`unaligned`；方法：`semantic`。
- 原始对象：`docs/decisions/archive/preserve-comparable-investigation-inputs.md`；修复前 SHA-256：`976e629d59a95cb05e4dcb650a91253c415df1822430b9a48a2dd366fadd0462`。
- 历史核对：`8be2bf136c47840d646c20cdd24bd7bff8d07d75:docs/decisions/investigation-report-behavior/preserve-comparable-investigation-inputs.md`。
- 完整采用方向：每份完整调查报告固定依次保存背景、调查动因、调查目标和调查结果，并在形成输入或解释实质变化时追加可独立比较的完整认识快照。
- 区分性依据：
  - `8be2bf136c47840d646c20cdd24bd7bff8d07d75:docs/decisions/investigation-report-behavior/preserve-comparable-investigation-inputs.md`：该提交仅新增决策与索引，提交主题也是“plan”；决策要求四个精确核心：背景、调查动因、调查目标、调查结果。
  - `8be2bf136c47840d646c20cdd24bd7bff8d07d75:scripts/investigation-report/src/markdown.ts`：同一形成树第 34 行仍将 requiredReportSectionTitles 固定为旧三段“背景、起因、调查结果”，与新决策缺少调查目标且语义不同。
  - `8be2bf136c47840d646c20cdd24bd7bff8d07d75:skills/investigation-report/references/investigation-report-contract.md`：同一树的分发契约第 103 行仍机械要求旧三段，且正文多处把起因作为固定核心；因此不仅实现未更新，公开行为 owner 也未采用该方向。
  - `3013fc3013dc1efe7ede1ccd5552b4c3bf8b25b6:docs/decisions/investigation-report-behavior/use-fixed-investigation-record-core.md`：8be2bf 的唯一直接子提交立即以实质不同的四段方向修订原记录。
  - `3013fc3013dc1efe7ede1ccd5552b4c3bf8b25b6:scripts/investigation-report/src/markdown.ts`：同一后继提交把检查器直接改为“形成时背景、调查目的、调查范围与依据、调查结果与边界”；此前没有中间提交形成原四段对齐树。
- 后续正文核对与局限：3013fc 及后续正文一直保留新四段方向；原方向在其 active 的唯一已提交树中只存在于计划记录，代码与契约仍是旧三段，下一提交即被不同方向修订。这里的 unaligned 由同一历史树的正面差异与无中间提交共同支持，不是由“未找到实现”默认推断。

### `inferred`（4 条）

#### `260701-add-submodule-release-workflows` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`inferred`。
- 原始对象：`docs/decisions/archive/260701-add-submodule-release-workflows.md`；修复前 SHA-256：`4996cec7166660012b2034835f88988c51708fbbcbbc7149c836a6b8bcedd03b`。
- 历史核对：`328bc9596924e7158d846f1710b1c4d07c10453b:docs/decisions/project-tooling/260701-amended-add-submodule-release-workflows.md`。
- 完整采用方向：每个子仓库以独立 publish workflow、skill-package.hash 和最小 Git 工具链发布自身 skill，同时保留主仓库聚合发布。
- 区分性依据：
  - `328bc9596924e7158d846f1710b1c4d07c10453b:docs/decisions/project-tooling/260701-amended-add-submodule-release-workflows.md`：记录声明三个 submodule 均有 publish-skill-package.yml 与 skill-package.hash，并称发布入口由 review 和 GitHub Actions 运行结果确认；但这只是历史验证声明，本地主仓库不能重读所指文件或运行结果。
  - `328bc9596924e7158d846f1710b1c4d07c10453b:docs/tooling.md`：主仓库文档描述子仓库用 HEAD:skill 计算 hash、独立打包与发布、且不安装主仓库工具链；它证明规则已记录，不能替代三个子仓库的实际配置。
  - `328bc9596924e7158d846f1710b1c4d07c10453b:git-commit-organizer`：该路径是 gitlink 315e45a0f807b2f0dcdcefe1b1dcb775795aea89；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
  - `328bc9596924e7158d846f1710b1c4d07c10453b:openspec-skills`：该路径是 gitlink 87f739583817fb16b4bfcfa4ffa010d225cbe1e2；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
  - `328bc9596924e7158d846f1710b1c4d07c10453b:prompt-optimize`：该路径是 gitlink 8bba6d657c6a6275b8202b18a9b4d332a562e33b；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
- 推断边界：用户允许按本地可复核材料作合理推断；三个子仓库的 publish workflow、hash 文件和运行结果均不能重读，gitlink 只证明指针同步。因此 `aligned` 是本次历史对齐推断，不表述为原始子仓库实现已验证。
- 后续正文核对与局限：64decf7b479d78f98dc4dbff90226a62196c4a57 的单仓库导入树只导入 skill 本体，说明后期已退出子仓库发布模型；该后期变化不改变本次基于维护记录、三指针同步和根侧规则作出的历史对齐推断。

#### `260701-publish-versioned-skill-releases` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`inferred`。
- 原始对象：`docs/decisions/archive/260701-publish-versioned-skill-releases.md`；修复前 SHA-256：`e455f58df9143c75d8a8cda0ea9db06f96c9d149d3d86061273e39ea8426ef16`。
- 历史核对：`5c1f6368261647701f3b57b649b14fe1de4180cf:docs/decisions/project-tooling/260701-active-publish-versioned-skill-releases.md`。
- 完整采用方向：主仓库聚合发布和三个子仓库独立发布均按内容 hash 创建版本化 release，并同步维护 latest 兼容入口。
- 区分性依据：
  - `5c1f6368261647701f3b57b649b14fe1de4180cf:.github/workflows/package-skills.yml`：主仓库可读 workflow 实现 skills-<hash12> 版本化 release、Latest 标记与 skills-latest 兼容入口，证明聚合发布部分。
  - `5c1f6368261647701f3b57b649b14fe1de4180cf:docs/decisions/project-tooling/260701-active-publish-versioned-skill-releases.md`：决策验证段声明三个 submodule 的 publish workflow 同样创建 <repo-name>-<hash12> 并维护 latest；提交说明也称指针同步到支持该功能的 workflow commit，但二者都不能展示实际 YAML。
  - `5c1f6368261647701f3b57b649b14fe1de4180cf:git-commit-organizer`：该路径是 gitlink 51c47c82c0c8717a7cd8aef2e75b40daca61ec50；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
  - `5c1f6368261647701f3b57b649b14fe1de4180cf:openspec-skills`：该路径是 gitlink 826b6fb0c774ccc61fedf40589b76b2a05999ef3；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
  - `5c1f6368261647701f3b57b649b14fe1de4180cf:prompt-optimize`：该路径是 gitlink 1fd1f42166947891a6f517d1da2f5c67a9b7ff36；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
- 推断边界：用户允许按本地可复核材料作合理推断；主仓库聚合 workflow 可读，但三个子仓库的实际 release YAML 与运行结果不能重读，gitlink 只证明指针同步。因此 `aligned` 是本次历史对齐推断，不表述为原始子仓库发布实现已验证。
- 后续正文核对与局限：27f8c84afbdf4c5d4415f2574ac5b1e04582ed41 随后把 tag 演进为时间戳加 hash；该后期修订不改变本次针对 5c1f636 的历史对齐推断。

#### `260701-update-package-hash-with-git-hooks` — `alignment: aligned`

- 主审批准的最终值：`aligned`；方法：`inferred`。
- 原始对象：`docs/decisions/archive/260701-update-package-hash-with-git-hooks.md`；修复前 SHA-256：`1a66e07021b71c5efe9def53dbfb7f75b77a79cd8e0a5089084db99a630bba1f`。
- 历史核对：`34b5c5e75eb8a96b68d6cb8d00dc46e46f1dfe0a:docs/decisions/project-tooling/260701-active-update-package-hash-with-git-hooks.md`。
- 完整采用方向：主仓库与每个子仓库都由 pre-commit 更新并暂存 skill-package.hash，CI 只校验提交树且不写回，发布以相邻提交 hash 差异门控。
- 区分性依据：
  - `34b5c5e75eb8a96b68d6cb8d00dc46e46f1dfe0a:.githooks/pre-commit`：主仓库 hook 可直接验证：拒绝脏子模块或未暂存指针，运行 hash-skills --write 并 git add 根 skill-package.hash。
  - `34b5c5e75eb8a96b68d6cb8d00dc46e46f1dfe0a:.github/workflows/package-skills.yml`：主仓库 CI 改为 --check --github-output 校验并按前一提交 hash 门控发布，不再包含 Actions 写回 hash 的 job。
  - `34b5c5e75eb8a96b68d6cb8d00dc46e46f1dfe0a:scripts/setup-git-hooks.ts`：安装器为根仓库以及实际存在 pre-commit 的子仓库设置 core.hooksPath；它不能证明三个子仓库文件当时的具体内容。
  - `34b5c5e75eb8a96b68d6cb8d00dc46e46f1dfe0a:git-commit-organizer`：该路径是 gitlink 47353a9493ea3275b8e4bd33e038f13fef9e8edc；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
  - `34b5c5e75eb8a96b68d6cb8d00dc46e46f1dfe0a:openspec-skills`：该路径是 gitlink ab0d6c953d3d0c501b7be278a5ab49680c9a951b；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
  - `34b5c5e75eb8a96b68d6cb8d00dc46e46f1dfe0a:prompt-optimize`：该路径是 gitlink b3ea2af9338df6fbf75336f82d80dd2adf5d843d；它与另外两个子仓库指针在同一主仓库提交中同步到新功能版本，但本地主对象库无该 commit，不能重读内部文件。
- 推断边界：用户允许按本地可复核材料作合理推断；根 hook/CI 可读，但三个子仓库的 hook、hash 与 workflow 不能重读，gitlink 只证明指针同步。因此 `aligned` 是本次历史对齐推断，不表述为原始子仓库实现已验证。
- 后续正文核对与局限：64decf7b479d78f98dc4dbff90226a62196c4a57 后的单仓库布局消除了子仓库 hook 边界；后期结构变化不改变本次基于根实现、三指针同步和验证记录作出的历史对齐推断。

#### `mask-non-code-test-syntax` — `alignment: unaligned`

- 主审批准的最终值：`unaligned`；方法：`inferred`。
- 原始对象：`docs/decisions/archive/mask-non-code-test-syntax.md`；修复前 SHA-256：`4f0994d649a50427fa99c3a62983a675abcf3fd6909a1cef9e2e3200711f655a`。
- 历史核对：`143adb7a436344b9e67ce4362d138761bd4c18c2:docs/decisions/test-evidence-review-behavior/mask-non-code-test-syntax.md`。
- 完整采用方向：在七种语言的测试入口正则前等长屏蔽常见注释、字符串、模板、原始字符串和正则样本，保留 UTF-16 offset/行列，并用表驱动测试同时证明真入口保留与非代码样本忽略。
- 区分性依据：
  - `c666e5ae621f660bc22d7de7e849245713dd4b9e:scripts/test-evidence/src/discovery.ts`：直接父树仍直接以 text.matchAll(pattern.expression) 扫描，没有七语言等长屏蔽实现。
  - `143adb7a436344b9e67ce4362d138761bd4c18c2:docs/decisions/decision-index.json`：索引保存原方向 createdAt 为 2026-07-21T01:52:14Z；首个可读 Git 提交时间为 2026-07-21T04:02:45Z。创建后同日即以已归档原方向和完整替代实现共同进入 Git。
  - `143adb7a436344b9e67ce4362d138761bd4c18c2:docs/decisions/test-evidence-review-behavior/260721-separate-test-entry-collection-from-ledger.md`：首个可读树已替代原方向，并同次落地不猜测非代码位置的独立 collector 架构；原方向要求的七语言屏蔽和表驱动验证未在该树出现。
- 推断边界：用户允许按本地可复核材料作合理推断；历史原始实现无法完整重读。直接父树缺少七语言屏蔽并不能排除缺失的、未提交快照曾完整实现并验证该方向；因此 `unaligned` 是本次历史对齐推断，不把理论反例写成观察到的失败，也不主张从未有原型、局部尝试或未提交开发。
- 后续正文核对与局限：结合直接父树、短时序内的整体替代和原方向的七语言/表驱动完整义务，最合理的本地重建是原方向未形成可作为完整已核对历史基线的对齐状态，因此为 unaligned。该结论不主张从未做过原型、局部尝试或未提交开发。

### 形成时的验证与未证明边界

- 实际写入计数：92 条，其中 87 条 `aligned`、5 条 `unaligned`。最终集合为 124 active、214 archived、321 aligned、17 unaligned、0 null。
- 所有批次均以同一选择先运行 `sync-index` dry-run，预期退出码 1、`outcome: no-change`；随后 same-select `--write`，strict 决策检查通过并复查 selected 项为当前。
- 全量字节核验：92 个目标相对基线仅 alignment 行不同；246 个非目标来源的原始 SHA-256 未变；`docs/decisions` diff 精确为 92 个目标 archive 文件加 `decision-index.json`，没有其他来源差异。
- 根目录 `bun run check` 已在正式报告第一版后通过：34 passed、0 failed、28 项 release 检查未启用，耗时 42.7 秒。该检查验证当前仓库状态，不证明历史时点的实施，也不验证 release 本身；本报告同样不把 4 条 `inferred` 的本地推断提升为原始实现已验证。
- 本轮刻意不创建第二份报告或资源；正式报告与派生索引由本次 publish 建立。
