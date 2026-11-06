# 双域 CLI 联合验收：字段审计与过程证据

状态：**本轮范围已调整为 Linux GNU x86_64；新源码尚未完成最终联合验收。**以下 `65c5c49` 的 Linux 结果仅作为形成过程，不能替代 Linux-only 修改后精确源码的重验。本表是逐命令字段核对；`compatibility.md` 是旧结果信息要求，`protocol.md` 是 native 映射定位；现行两域 CLI 操作 owner 决定局部读取及写集。不能因为旧 DTO 的字段名扩大未选候选范围。下列 32 行所列可选择 Cargo 节点均已在下述冻结测试快照实际运行通过；CLI 观察来自下述同源 release 二进制的独立私有进程。证据覆盖所列字段与代表边界，不声称穷尽所有参数及规则组合。

## 共同字段与证据规则

- **E（协议）**：除成功 trace 外，JSON 是单对象 `version/command/ok/diagnostics` 加成功 `result` 或失败 `error` 和有证明的部分 result；warning 同时 stderr，0/1/2 分别为成功/领域或系统失败/参数失败。成功 trace 原对象、IR `warnings`、DR `source` 不加 envelope。`tests/cli_entry.rs` 的 non_unicode/invalid_query 两节点证明 argv 和错误通道的对应边界；本脚本实进程均解析完整单对象、分别观察 0/1/2，IR 不就绪候选 warning 走 stderr。
- **T（事务）**：实际 `status/changed/committed/verification/outcome/writtenPaths/unknownPaths/errors/cleanupErrors` 与条件性恢复备份、目录、诊断构成事实；`planned*` 或 preflight review 不等于写入；postverify/cleanup 失败不得给成功 review。`cli::tests::transaction_failure_keeps_backups_unknown_paths_and_withholds_review`、`transaction::tests::freshness::postcommit_failure_never_rolls_back_or_overwrites_rival`、`transaction::tests::outcomes::planned_value_is_retained_only_after_successful_prepare_and_never_as_success_on_failure` 为对应独立节点，已在冻结测试快照实际运行。计划身份只在准备成功且失败分支具备证据时输出；`tests/cli_entry.rs::identity_failure_reports_prepared_plan_separately_from_actual_writes` 专门核对。
- **Q（搜索）**：`query.{text,in,match,filters,limits.{maxRecords,resources,preview}}`、`source.{kind,currentness,fallback}`、`counts.{matched.value,matched.precision,returned}`、`coverage.{scanComplete,resultsComplete,previewsComplete,reasons}` 承接旧信息；metadata 的不适用 resources/preview 与 previewsComplete 是明确 `null`，`filterRelations` 无条件时省略，不混同空数组。位置/范围以 UTF-16 单元计。对应 `queries/metadata_search.rs::{investigation_metadata_search_counts_all_matches_before_limit,decision_metadata_search_preserves_match_evidence_and_exact_counts}`、`queries/content_search.rs::{investigation_content_search_counts_hidden_hit_and_exposes_preview_ranges,decision_content_preview_serializes_lone_surrogate_without_replacement,investigation_content_search_stops_after_first_hidden_hit_and_reports_lower_bound}`；本脚本手写 emoji/位置与 metadata 单对象。具体预算值见 compatibility。
- **R（关系审阅）**：phase 分 preflight/committed；每 source 的 ID、action、before、after 与 type/target/可选 summary 不压缩。`mutations::relations::tests::review_json_keeps_domain_edge_names_and_omits_absent_summary`、两域 relations/operation 的私有测试承接图与事务；脚本独立检验两域非空替换、摘要、关系被写入和 no-op。
- **S（索引同步）**：full/selected、preflight/实际/unchanged、changedIds、selectedIds、selectors、indexPath、warning；selected 另显式 `coverage.source/currentness/checkedIds`。IR 的可信 baseline count 保留；没有可信 baseline 不造已观察 count。失败保留目标、原因、恢复及可观察事务事实。`mutations::{decision_sync,investigation_sync,decision_selected_sync,investigation_selected_sync}::tests` 验证局部证明/fresh 和依赖；脚本直接验证 typed DTO 真实 JSON、selected 依赖、变更/不变/预检零写以及缺失/损坏 baseline、stale、重复和多个无效 selector。
- **G（stage）**：scope、selectedIds、writtenPaths、preservedPendingPaths、callerOwnedPaths；DR indexRelativePath/pendingFileCount，IR indexPath/namespace/state/changed；失败 pending outcome 与 unknown changed:null 独立表达。`tests/git_stage/stage_index.rs::{cli_unresolved_selector_reports_target_recovery_and_unchanged_pending,cli_stale_selected_source_reports_identity_path_and_sync_recovery}`、`tests/git_stage/stage_decision.rs::decision_source_scopes_stage_selected_document_and_preserve_unrelated`；脚本以独立 Git HEAD/P/worktree blob 和集合内外未选 pending 比较单对象及两对象。

## 32 行逐命令映射

每行的“CLI”是本任务私有脚本中的真实二进制、人工输入/期望观察；“节点”是补充较深分支的可选择 Cargo 节点，不以 API 节点冒充 CLI 成功路由。下表字段审计仅声明列明的信息项及代表边界；未知、失败和各平台执行仍遵守上节和最后状态。

| 域 / 命令 | 旧信息 → native 字段或合法重组 | 代表证据 / 冻结后观察与原生节点 |
| --- | --- | --- |
| DR candidates | `records[].decisionId/sourcePath/projection/tags/status/alignment/createdAt/scaffoldValid/bodyReady`；候选 null 生命周期保留 | CLI 未就绪候选；`queries::candidates::decision_candidates_discover_and_warn_about_missing_dependency` |
| DR check | summary 8 项、checkedIds、scope/index/errors/warnings | CLI 全量；`queries::check::decision_check_cli_keeps_aggregated_diagnostics_and_partial_scope` |
| DR discard | oldId、candidate、实际 sourcePaths/indexChanged、T；历史确认/引用错误不伪造删除 | CLI 候选真实退出；`mutations::discard::tests::blocks_formal_references_and_requires_resource_and_history_confirmation` |
| DR list | records 完整 projection/关系、source、appliedFilters、facets、limit/offset/total/warnings | CLI tag/limit；`queries::snapshot_queries::decision_list_default_filter_and_facets_include_archived_records` |
| DR new | created/id/decisionId/sourcePath/readiness/warnings 与 T；提交后失败可已创建 | CLI 由 UTC 日期推 ID；`authoring::create::creation_is_atomic_and_does_not_overwrite_existing_candidate` 与 T |
| DR publish | establishedIds/archivedIds/discardedId、preflight、R、T；允许键名重组 | CLI 预检及写入；`decision_authoring::publication::publish_successor_archives_predecessor_in_new_directory` |
| DR rename | old/new ID/name/path、候选/正式影响计数及 scope、preflight planned 与实际 indexChanged/sourcePaths、T | CLI 候选及正式引入边；`identity::pending::decision_rename_rejects_collection_pending_and_rechecks_before_write` |
| DR search | records 完整 projection、metadata matchedFields/matchedRelations 或 content previews、Q/truncation | CLI metadata、emoji content；Q 所列节点 |
| DR set-relations | sourceIds、indexPath、preflight、R、T | CLI 非空摘要替换及真正 unchanged；`mutations::decision_relations::tests::private_set_relations_preserves_unselected_source_scope_and_reports_review` |
| DR show | body 完整、record、warnings（包括来源 revision 差异） | CLI 独立比较原始正文；`queries::snapshot_queries::decision_show_rejects_mismatched_identity_and_keeps_current_body` |
| DR show-candidate | body、record/readiness/null 生命周期及 warning | CLI 真实新建候选读取；DR candidates 节点 |
| DR stage | G | CLI 真实 Git 与双对象；G 所列节点 |
| DR sync-index | S | CLI full/selected 的 preview、write、unchanged 和依赖；S 所列节点 |
| DR trace | status/source/anchorId/direction/limits/coverage/traceIds/contextIds/frontier/可选 blockedEvent/完整 entries，成功不包装 | CLI 手写单节点和有边预算全对象；`queries::snapshot_queries::decision_trace_blocks_full_reallocation_event` |
| DR archive | affectedIds、affected 每条 before/after 状态与 alignment、路径及 T | CLI 真实归档；`mutations::decision_operation::tests::private_archive_outside_git_and_precommit_recovery` |
| DR evolve | establishedIds/archivedIds/discardedId、preflight、R 与 T | CLI 后继真实建立；`decision_authoring::publication::grouped_relations_bind_to_successors_and_discard_candidate` |
| DR mark-aligned | affectedIds、before/after 生命周期与 alignment、sourcePaths、T | CLI 真正状态变化；`mutations::decision_operation::tests::private_mark_aligned_preflight_and_transaction` |
| DR reactivate | preflight 或实际 affectedIds/before/after/路径与 T | CLI 两阶段；`mutations::decision_operation::tests::private_reactivate_moves_source_and_publishes_index` |
| IR candidates | candidates[].id/path/markdown/errors/warnings/readiness 三项 | CLI 未就绪候选和 stderr warning；`queries::candidates::investigation_candidate_empty_section_keeps_identity_and_line_diagnostic` |
| IR check | availableReportCount/selectedReportCount/indexChecked/indexPath/errors/warnings，scope/checkedIds | CLI 全量；`queries::check::investigation_check_cli_keeps_aggregated_diagnostics_and_partial_scope` |
| IR discard | id/deletedResourceIds/requiresRecordedDeletionConfirmation、indexPath（正式）及 T | CLI owner 资源非空实际删除、未授权零写、Git 已记录确认；`investigation_identity::git_recorded_candidate_requires_explicit_confirmation` |
| IR list | entries[].id/state/filterRelations、indexPath、filters/facets/limit/offset/total/errors/warnings | CLI tag/limit；`queries::snapshot_queries::investigation_list_filters_pages_and_keeps_full_snapshot_facets` |
| IR new | id/sourcePath/readiness/warnings/created 与 T；已创建而 cleanup 失败不等同零写 | CLI 固定 formed-at 推 ID；`authoring::create::investigation_unready_scaffold_is_still_created` 与 T |
| IR publish | ids 重组为 publishedIds、warnings、preflight、R、T；两个候选同事务 | CLI 双对象；`authoring::publication::publish_batch_closes_relations_without_reading_unselected_body` |
| IR rename | old/new ID/name/path、两关系计数/资源引用计数和范围、ownerMoved、planned/实际写集与 T | CLI 非空正式引用及实际资源 owner 移动；`investigation_identity::published_rename_updates_referrer_and_discard_rejects_references` |
| IR search | entries 原搜索 DTO、filterRelations、matchedFields/matchedRelations 或 previews、Q、truncation/status/indexPath/errors/warnings/failureKind | CLI metadata、emoji content；Q 节点及 `queries::content_search::investigation_search_failure_preserves_failure_kind_without_fake_counts` |
| IR set-relations | sourceIds、indexPath、errors、preflight、R、T | CLI 非空摘要替换及 unchanged；`mutations::investigation_operation::tests::private_fixture_preflight_and_committed_relation_then_unchanged` |
| IR show | id/indexPath/markdown/state/errors/warnings、完整原文 | CLI 真实原文；`queries::snapshot_queries::show_reads_selected_utf8_checks_identity_and_reports_stale_revision` |
| IR show-candidate | candidate id/path/markdown/errors/warnings/readiness、顶层 warnings | CLI 候选 warning 双通道；IR candidates 节点 |
| IR stage | G | CLI 真实 Git 与双对象；G 所列节点 |
| IR sync-index | S | CLI full/selected 的 preview、write、unchanged 和依赖；S 所列节点 |
| IR trace | status/anchorId/direction/limits/coverage/traceIds/contextIds/frontier/可选 blockedEvent/完整 entries/warnings，成功不补 source 或包装 | CLI 手写单节点和有边预算全对象；`queries::snapshot_queries::investigation_trace_blocks_a_split_as_a_whole` |

## 冻结身份、执行与结论

- 实际输入为提交 `65c5c49cd7be5084d1b73637c5d1eb21ea8ccbc5` 的候选源码；工作区开始时相关路径无未提交改动。将 `tools/record-cli/` 排除 `target/` 的 356 个普通文件复制到独立目录，逐文件路径与 SHA-256 的排序清单再取 SHA-256 得 `77ffa44299c48a6f9dbdd1aabe36d4495fe5a1572d0ec18bb747437c9f886a23`。快照与工作区在构建、运行前后逐文件一致，运行后 HEAD 仍为该提交。这个清单包含 manifest、lock、Rust 运行时、测试、工具链、候选文档与辅助交付材料；release 编译只使用其构建子集。
- Cargo 原生测试还通过 `include_str!` 读取 `tools/investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md`，SHA-256 为 `b4c0bd95d94080cdb0cfc68c56e5e95877c851e97d7445dca7a683d141f49d79`。按原相对位置复制并独立核对后，356 个候选文件加此 fixture 的 357 文件测试输入清单 SHA-256 为 `0ca71320e15fc09952f443d87b84c3291a0db06d8814e1b7a3ce1a58d47fe54b`；测试前后私有与仓库 fixture 字节一致。release 二进制编译不使用该 fixture，但 Cargo 全测试不能只复制候选目录。
- 实际环境为 Linux x86_64、WSL2 kernel `6.18.33.2-microsoft-standard-WSL2`、工作区 `stat -f` 为 `ext2/ext3`、glibc 2.43、Git 2.53.0；rustc 1.98.1 (`48a229cea`)、Cargo 1.98.1，Cargo.lock SHA-256 `4cb266d231fe5a4463abaea1c7dec78e1998d09760f76445d84e765bf073d1fb`。从上述隔离快照执行 `cargo +1.98.1 build --manifest-path <snapshot>/source/Cargo.toml --locked --offline --release --bins --target-dir <snapshot>/target` 成功。直接验收的二进制 SHA-256：DR `9ce8071bbe3261fda9657eee0c974bb52a6cb700fe4f6fa089296a12a319ac30`；IR `37b9a1b50806201f176e1cf0b48df40fdf83811c873e778b334098bcd87101ab`。
- 清除 `SKIP_DUPLICATE` 和 `SKIP_KNOWN_GAPS`，对这两个精确 release 二进制运行一次性私有 `check.py`：**110 次进程观察通过，0 跳过**，日志分别确认 DR 18、IR 14 个不同命令的真实成功出口。`identity_probe.py` 同样零跳过重跑该矩阵并补验正式引用、资源 owner 移动、影响计数及域外 pending；不读写真实记录。脚本 SHA-256 分别为 `d3d669f80d2cb6c90c21f2ff1f63a3306bb627edf2cfc790fe54fdb759e553e8`、`213bb4a542e62473a7e2ffaa4d4e0fde9d788eeadfb36801e2acde11417880ac`。其末尾固定文本 `PARTIAL ONLY` / `IDENTITY PRELIMINARY` 保留为两平台与全 Change 未完成的边界，不否定本次绑定提交、源码和二进制的 Linux 观察。
- 同一快照执行 `cargo +1.98.1 test --manifest-path <snapshot>/source/Cargo.toml --target-dir <snapshot>/target --release --locked --offline --all-targets -- --include-ignored` 成功：**190 个 library 与 122 个 integration 节点通过，0 failed、0 ignored**。日志中还有测试自行启动的三个单节点结果，不重复计数。上表引用的 29 个具名节点均已在该次日志中核对为 `ok`。
- 私有过程日志 SHA-256：matrix `771d4714b87915fc41cb77db4bd9b9ede4c6d42d0d1b79f8361c763facbfe0bf`、identity `fe5c4a15092dbf0f9ffd66810e33c132bb7efb4b580ec53b15d0f942d2726537`、Cargo `dd850e839a2f8952e4d54ec5c200731b88ea1ee85daafbce6e87fe7d62ac1e9c`。临时日志、私有 `.git`、fixture 副本与二进制不提交。仓库内可核实调用者和唯一批准的孤立 UTF-16 源/索引结构化拒绝见 `capability-mapping.md`；正常 emoji、UTF-16 preview 及各域成功 trace 全对象在本次真实进程重验。

形成阶段结论：在上述 Linux 环境及当时 `65c5c49` 精确冻结源码范围内，双域 32 命令成功路由、逐项字段映射和代表失败/恢复边界形成可核对证据；本次 Linux-only 源码尚须重新建立对应证据。这不是全部参数组合穷举，也不证明 Windows 原生、Ubuntu 22.04 原生、最终 CI、Case、性能或发布；这些由各自 owner 独立验收。

此前 `be1e9c4` 的 110 次观察及随后测试同步、Git/Windows 路径修复仅是形成过程，不替代上述对新运行时的完整重验；同样，旧性能结果不覆盖后来运行时修复。字段审计发现的历史确认、资源删除确认及预检诊断传播问题，在本次精确 release 进程中均已重验。

## 当前范围调整

用户已决定本候选仅验收 Linux GNU x86_64，以 Ubuntu 22.04/glibc 2.35 为冻结原生验收环境；Windows 候选不在本轮，现行 TypeScript 和视频工具的 Windows 支持不因此变化。当前修改尚未提交，下文形成阶段的 hash、二进制和测试结果均不代表该修改后的源码；待新提交冻结后，从精确隔离快照重新构建并重跑 32 命令联合矩阵、实际 Cargo 节点及相关验收。
