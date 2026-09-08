# 历史对齐状态召回线索

本文件保存只读调查基线与逐条定位信息。执行者按 design 复核后形成回填集合；本清单本身不批准写入。

## 基线与方法

- 基线：`0215c38fbf1228a9265bfd3beda15286f97a8ae2`，调查日期 2026-09-08；本仓库非 shallow clone。
- 目标：当前 92 条 archived/null；按 HEAD 可达历史逐条 `git log --follow` 追踪路径并读取历史文件，另读 171 个决策索引修订。
- 已定位的 31 条都在归档提交的直接父版本保存 `status: active`、`alignment: aligned`；扫描未发现其后重新激活。
- 28 条在该归档提交只改 status/alignment，3 条还有下表所列变动。当前正文与后续历史仍需在写入前逐条复核。
- 其余 61 条未找到非空字段，历史索引扫描没有增加可恢复对象。未发现字段不是未实施的证明。
- 文件历史中 4 个早于 alignment 引入的删除节点没有对应 blob；不将删除或文件缺失作为对齐证据。
- 19 条旧值首次出现于引入 alignment 的批量迁移提交；恢复这些值只恢复历史登记，不声称已重新验证当时实现。

## 历史规则证据

- `3a124c45cd1824e7d3155fcc628e190d6f6e20cf` 首次引入 alignment，快照为 59 archived/null、45 active/aligned；父版本索引没有 alignment。
- 同提交的 `scripts/decision-records/src/cli.ts` 第 638–643 行在归档时写入 null。
- `45b5ea3` 将对齐明确为完整目标经核对建立的单向基线；unaligned 不等于历史上绝对从未实施。
- `71ed942f59e5980f588cf29f57848c4ca840543b` 的 `tools/decision-records/src/decision-lifecycle-service.ts` 第 563–576 行改为保留归档前值。

## 有明确旧值的 31 条

所有建议旧值均为 aligned。历史路径相对仓库根；可用 `git show <归档提交>^:<历史路径>` 重读直接父版本。

| Decision ID | 归档提交 | 历史路径 | 归档时其他变化 |
| --- | --- | --- | --- |
| `260702-use-monorepo-skills-directory` | `e4f35740be7fedfb09189b34b44f6c572a83942e` | `docs/decisions/project-tooling/260702-use-monorepo-skills-directory.md` | 仅生命周期字段 |
| `260703-follow-latest-release-for-skill-updater` | `e4f35740be7fedfb09189b34b44f6c572a83942e` | `docs/decisions/project-tooling/260703-follow-latest-release-for-skill-updater.md` | 仅生命周期字段 |
| `260703-use-per-skill-hash-lock-for-updater` | `e4f35740be7fedfb09189b34b44f6c572a83942e` | `docs/decisions/project-tooling/260703-use-per-skill-hash-lock-for-updater.md` | 仅生命周期字段 |
| `260720-expose-importable-skill-modules` | `f7b64b007487b5016400883a54bc631a227a2282` | `docs/decisions/project-tooling/260720-expose-importable-skill-modules.md` | 仅生命周期字段 |
| `260720-focus-entry-on-behavior-routing` | `ddaae930689ff408f1453802e6c3d2a75710d3fe` | `docs/decisions/decision-records/260720-focus-entry-on-behavior-routing.md` | 仅生命周期字段 |
| `260720-map-test-entries-and-trigger-scoped-reviews` | `ea0be0edecbee561ef06312c10de2cd8f8c59a12` | `docs/decisions/test-evidence-review/260720-map-test-entries-and-trigger-scoped-reviews.md` | 仅生命周期字段 |
| `260720-orchestrate-checks-with-conservative-concurrency` | `6aa9e1e7febb389f136b659d10664001ff007ab0` | `docs/decisions/project-tooling/260720-orchestrate-checks-with-conservative-concurrency.md` | 仅生命周期字段 |
| `260720-organize-proofs-by-shared-execution-chain` | `efd1a3fadbac34b39034ec6aa255cd5d0a73246c` | `docs/decisions/test-evidence-review/260720-organize-proofs-by-shared-execution-chain.md` | 仅生命周期字段 |
| `260720-use-prebuilt-git-test-fixtures` | `f7b64b007487b5016400883a54bc631a227a2282` | `docs/decisions/project-tooling/260720-use-prebuilt-git-test-fixtures.md` | 仅生命周期字段 |
| `allow-sequential-activation-of-prewritten-candidates` | `8dd0c02b99a37d8754510929aa93fb586fda5276` | `docs/decisions/decision-records/allow-sequential-activation-of-prewritten-candidates.md` | 仅生命周期字段 |
| `catalog-minimal-native-test-entries` | `f77bb607547bbe0692a22ad5c7fb7ed3811a3154` | `docs/decisions/test-evidence-review/catalog-minimal-native-test-entries.md` | 仅生命周期字段 |
| `complete-current-decision-work-by-task-outcome` | `8dd0c02b99a37d8754510929aa93fb586fda5276` | `docs/decisions/decision-records/complete-current-decision-work-by-task-outcome.md` | 关系目标路径调整 |
| `derive-establishment-from-markdown-lifecycle` | `ddaae930689ff408f1453802e6c3d2a75710d3fe` | `docs/decisions/decision-records/derive-establishment-from-markdown-lifecycle.md` | 仅生命周期字段 |
| `express-alignment-as-field-relation` | `45b5ea363456f6ec0dfd6dda3635dfa1d79007c0` | `docs/decisions/decision-records/express-alignment-as-field-relation.md` | 仅生命周期字段 |
| `generate-index-from-self-contained-decisions` | `decb5a87b01d5fdc57dcd07bce1ad108d0d67925` | `docs/decisions/decision-records/generate-index-from-self-contained-decisions.md` | frontmatter 投影迁移 |
| `index-ledger-by-stable-case-state` | `ea0be0edecbee561ef06312c10de2cd8f8c59a12` | `docs/decisions/test-evidence-review/index-ledger-by-stable-case-state.md` | 仅生命周期字段 |
| `organize-native-test-cases-by-responsibility-topic` | `034e0a15daeb333637408aaf71d956f65782204a` | `docs/decisions/test-evidence-review/organize-native-test-cases-by-responsibility-topic.md` | 仅生命周期字段 |
| `organize-test-cases-by-controlled-topic-path` | `8788cf110827296405b0abdf772add33b77e3887` | `docs/decisions/test-evidence-review/organize-test-cases-by-controlled-topic-path.md` | 仅生命周期字段 |
| `publish-only-layered-test-evidence-interfaces` | `ea0be0edecbee561ef06312c10de2cd8f8c59a12` | `docs/decisions/test-evidence-review/publish-only-layered-test-evidence-interfaces.md` | 仅生命周期字段 |
| `query-projected-decision-metadata` | `8dd0c02b99a37d8754510929aa93fb586fda5276` | `docs/decisions/decision-records/query-projected-decision-metadata.md` | 仅生命周期字段 |
| `read-ledger-contract-on-demand` | `ea0be0edecbee561ef06312c10de2cd8f8c59a12` | `docs/decisions/test-evidence-review/read-ledger-contract-on-demand.md` | 仅生命周期字段 |
| `recover-current-format-tools-and-index` | `a92e00087d4eec90a8c549a39d4490902a0600b8` | `docs/decisions/decision-records/recover-current-format-tools-and-index.md` | schema v4 措辞改为当前 schema |
| `register-one-case-per-independent-verification-entry` | `ed5dc4b4e11c443954484b6305d7eb2fcd4aa2f2` | `docs/decisions/test-evidence-review/register-one-case-per-independent-verification-entry.md` | 仅生命周期字段 |
| `review-verification-implementations-with-explicit-indexed-cases` | `efd1a3fadbac34b39034ec6aa255cd5d0a73246c` | `docs/decisions/test-evidence-review/review-verification-implementations-with-explicit-indexed-cases.md` | 仅生命周期字段 |
| `separate-activation-effect-from-head-pending` | `8dd0c02b99a37d8754510929aa93fb586fda5276` | `docs/decisions/decision-records/separate-activation-effect-from-head-pending.md` | 仅生命周期字段 |
| `separate-distributable-tool-source-from-repository-automation` | `e4f35740be7fedfb09189b34b44f6c572a83942e` | `docs/decisions/project-tooling/separate-distributable-tool-source-from-repository-automation.md` | 仅生命周期字段 |
| `use-configurable-self-contained-decision-root` | `8dd0c02b99a37d8754510929aa93fb586fda5276` | `docs/decisions/decision-records/use-configurable-self-contained-decision-root.md` | 仅生命周期字段 |
| `use-field-alignment-commands` | `8dd0c02b99a37d8754510929aa93fb586fda5276` | `docs/decisions/decision-records/use-field-alignment-commands.md` | 仅生命周期字段 |
| `use-frontmatter-projection-and-semantic-field-order` | `8dd0c02b99a37d8754510929aa93fb586fda5276` | `docs/decisions/decision-records/use-frontmatter-projection-and-semantic-field-order.md` | 仅生命周期字段 |
| `use-independent-change-plans` | `a0079d351a2230c2ecced72d7596f4a490124783` | `docs/decisions/change-plan/use-independent-change-plans.md` | 仅生命周期字段 |
| `use-independent-read-side-index-runtime` | `8dd0c02b99a37d8754510929aa93fb586fda5276` | `docs/decisions/index-runtime/use-independent-read-side-index-runtime.md` | 仅生命周期字段 |

## 未找到非空旧值的 61 条

以下记录需要结合历史仓库状态召回。`establish-decisions-with-atomic-evolution` 和
`index-independent-proof-cases-from-current-catalog` 的首次可见 Git 版本已经 archived/null；其余 59 条的最早版本尚未包含 alignment 字段。

- `260627-establish-decision-record-policy`
- `260630-merge-prompt-optimize-core-flow-into-entry`
- `260630-name-decision-root-docs-by-owner`
- `260630-publish-skill-package-as-latest-release`
- `260630-reorganize-prompt-optimize-rewrite-rules-as-pipeline`
- `260630-track-decision-status-and-relations`
- `260630-use-compact-decision-records`
- `260701-add-submodule-release-workflows`
- `260701-compact-entry-and-archive-migration-copies`
- `260701-embed-self-update-script-in-skill-packages`
- `260701-gate-latest-release-by-skill-hash`
- `260701-publish-versioned-skill-releases`
- `260701-update-package-hash-with-git-hooks`
- `260710-use-cli-active-index-and-invalidated-archive`
- `260710-use-explicit-portable-decision-memory`
- `260711-bound-history-with-direct-relations`
- `260711-repair-noncanonical-decision-formats`
- `260711-require-confirmed-decision-writes`
- `260711-separate-skill-script-source-and-generated-artifacts`
- `260711-use-bundled-contract-owner`
- `260713-recall-before-long-lived-changes`
- `260713-use-json-current-index-and-stable-paths`
- `260718-add-direction-and-depth-to-trace`
- `260718-notify-before-decision-writes`
- `260718-separate-behavior-entry-from-storage-contract`
- `260718-separate-logical-archive-from-relations`
- `260718-use-purpose-background-decision-structure`
- `260719-model-verification-obligations-and-source-roles`
- `260719-organize-multi-branch-proofs-by-shared-base`
- `260719-own-project-aware-skill-lifecycle`
- `260719-separate-test-value-from-ledger-validation`
- `260720-auto-initialize-index-on-first-activation`
- `260720-complete-by-task-outcome`
- `260720-define-skills-by-self-contained-contracts`
- `260720-keep-problem-reframing-self-contained`
- `260720-return-query-results-with-warnings`
- `260720-separate-editorial-edits-from-evolution`
- `260720-separate-framing-from-engineering-landing`
- `260720-separate-status-commands-from-relations`
- `260720-use-configurable-decision-root`
- `260720-use-filtered-decision-queries`
- `260720-use-lifecycle-index-and-semantic-paths`
- `260720-use-product-and-architecture-lenses`
- `260721-separate-test-entry-collection-from-ledger`
- `append-self-contained-investigation-reports`
- `converge-records-before-stable-baseline`
- `define-decision-alignment-semantics`
- `derive-pending-from-head-path`
- `establish-decisions-with-atomic-evolution`
- `express-decision-alignment-state`
- `index-independent-proof-cases-from-current-catalog`
- `mask-non-code-test-syntax`
- `package-index-json-schema`
- `preserve-comparable-investigation-inputs`
- `query-ledger-with-structured-inspection`
- `support-degraded-decision-maintenance`
- `use-alignment-aware-decision-commands`
- `use-error-recovery-reference`
- `use-report-oriented-investigation-rounds`
- `use-second-precision-lifecycle-index`
- `use-topic-filtered-decision-queries`

## 使用与交接

实施时重新盘点来源，并为每条记录保存审查后的历史时点、证据、结论与不足。只有来源和语义复核通过的记录才能进入回填集合；此清单不能直接作为无条件批量写入输入。
