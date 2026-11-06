# 双域 CLI 联合验收：字段审计与过程证据

状态：**此前冻结源码的 Linux 联合 CLI 契约验收通过；后续运行时修复尚待重新联合验收，Windows 原生及 Change 其他门禁未在此证明**。本表是逐命令字段核对；`compatibility.md` 是旧结果信息要求，`protocol.md` 是 native 映射定位；现行两域 CLI 操作 owner 决定局部读取及写集。不能因为旧 DTO 的字段名扩大未选候选范围。下列 32 行所列可选择 Cargo 节点均已在下述冻结测试快照实际运行通过；CLI 观察来自下述同源 release 二进制的独立私有进程。证据覆盖所列字段与代表边界，不声称穷尽所有参数及规则组合。

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

- 工作树基准 Git HEAD 为 `8268a7d40558bffa8b99873c29a72e1cc7414639`，但候选当时尚未提交，**HEAD 不是受测源码的完整身份**。总冻结后，将 `tools/record-cli/` 排除 `target/` 的全部 356 个普通文件复制到独立目录；对逐文件路径及 SHA-256 的排序清单再取 SHA-256 为 `93583e8c09922c87ec8025eef56652fb56b111a47e47e1d0a1ac951d466d814d`。源工作树构建前、构建后及测试后与快照清单完全一致。该快照包含 Cargo manifest、lock、源码、测试、工具链、交付/性能辅助及候选文档；release 编译不使用后者。
- 提交后只读复核：最终提交 `be1e9c4053e292a0ea3d0959f275e4cc1295f677` 中 `tools/record-cli/` 与上述实测快照均为 356 个文件，路径集合完全一致；逐文件字节仅有 `benchmarks/README.md` 和 `compatibility.md` 各删除一个末尾空行，其余文件完全相同。两处均为无语义的文档空白变化；Rust 源码、Cargo manifest/lock、工具链、测试及测试输入均未变化，外部 IR fixture 在该提交中仍为下述同一 hash。上述 `93583e8c…` 仍是**实际构建与运行时的旧快照身份**，不改称最终提交的完整目录 hash；基于此精确差异，不再重跑 Cargo 或真实进程。
- 后续测试专用增量：为避免测试 worker 到达注入钩子前退出时无界等待，工作区仅调整 `tools/record-cli/src/transaction/tests/` 下 8 个文件的 7 个既有节点，将两阶段同步改为 30 秒有界会合；运行时源码、CLI 契约和节点名称未改变。本报告的 32 命令 release 二进制证据仍绑定上述实测快照，不声称该测试增量已包含在旧测试快照或旧 hash 中。对该增量的 Linux 定向测试由其 owner 另行执行；Windows 原生运行当时仍在等待，挂点原因尚未确认，不能将此修改称为已证明的挂起根因或 Windows 修复。
- 后续平台修复阶段（基准 HEAD `9d239ad2`）：Windows 原生运行 `42220026108` 的 library 报告 144 通过、45 失败；原挂起的 4 个测试现已在 30 秒超时后失败，不能把有界退出当平台通过。当前另有 Git 本地路径转 Git 斜杠及 Decision 路径展示、Windows 目录枚举缺失/别名区分，以及有限测试诊断和 Windows sharing-violation 场景变更。以上包含运行时代码变更，**不属于此前实测源码或二进制**；旧的 32 命令结果和性能只证明当时快照，不证明新运行时。静态复核和 owner 的 Linux 定向/Windows 交叉检查不替代最终稳定源码后的重新联合验收与 Windows 原生证据。临时 Windows 诊断探针只在原测试失败时于私有 fixture 内执行，定位后仍须退出。 对本阶段变更的只读复核中，Git 本地路径的 ADS 与设备名漏检已由 owner 按现行 `RelativePath` 边界补齐，原始 Git 反斜杠仍独立拒绝；这不构成对所有 Win32 名称的全面验证。目录缺失与大小写别名的区分、私有失败探针和 Windows sharing-violation 测试分支未发现确定性审查阻断，仍须原生运行验证。
- 原生测试还有一个跨目录编译输入 `tools/investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md`，SHA-256 为 `b4c0bd95d94080cdb0cfc68c56e5e95877c851e97d7445dca7a683d141f49d79`。`src/mutations/check/tests/mod.rs:53,112`、`src/mutations/investigation_selected_sync/tests/mod.rs:63`、`src/mutations/investigation_sync/tests/mod.rs:39,105,150,186` 通过 `include_str!` 读取。将它按原相对位置加入私有测试快照后，候选全部 356 文件加该 fixture 共 357 文件的路径/hash 排序清单 SHA-256 为 `b5954820c459059521208ba24ed219d552816fa2d2d2d9c55402f30ebda518b2`；测试前后 fixture 与实际仓库来源逐字节一致。release CLI 构建不依赖该 fixture；不能声称 Cargo 测试仅以候选目录即可独立编译。
- 实际环境：Linux x86_64、WSL2 kernel `6.18.33.2-microsoft-standard-WSL2`、工作区 `stat -f` 报 `ext2/ext3`、glibc 2.43、Git 2.53.0；rustc 1.98.1 (`48a229cea`)、Cargo 1.98.1，锁文件 SHA-256 `4cb266d231fe5a4463abaea1c7dec78e1998d09760f76445d84e765bf073d1fb`。离线命令为 `cargo +1.98.1 build --manifest-path <snapshot>/source/Cargo.toml --locked --offline --release --bins --target-dir <snapshot>/target`，实际成功。二进制 SHA-256：DR `ddb413c857a6d263fa8d57858d4ea355653fe3d1283c4b5e319ac7b1aaa28394`；IR `1f19cfc555fc1de831fd2da2f9830aa228eb5cc4913239a3bca6a1877668db34`。两者均直接从上述冻结快照构建，不沿用旧 debug 产物。
- 对这两个精确 release 二进制，清除 `SKIP_DUPLICATE` 与 `SKIP_KNOWN_GAPS` 后执行 `python <private>/check.py <DR-bin> <IR-bin>`：**110 次进程观察通过、0 跳过**；日志分别观察 DR 18、IR 14 个不同命令的真实成功出口。执行 `python <private>/identity_probe.py <DR-bin> <IR-bin>`：同样零跳过重跑该矩阵并额外核对真实正式关系改写、未选候选保持、资源 owner 移动、影响计数和域外 pending。两个辅助脚本的 SHA-256 分别为 `d3d669f80d2cb6c90c21f2ff1f63a3306bb627edf2cfc790fe54fdb759e553e8`、`213bb4a542e62473a7e2ffaa4d4e0fde9d788eeadfb36801e2acde11417880ac`。脚本末尾的 `PARTIAL ONLY` / `IDENTITY PRELIMINARY` 是保守的固定文本：本轮使用上述总冻结输入、无跳过和真实 release 产物；它们不声明两平台或整个 Change 完成。
- 在补齐上述外部 fixture 的同一快照执行 `cargo +1.98.1 test --manifest-path <snapshot>/source/Cargo.toml --target-dir <snapshot>/target --release --locked --offline --all-targets -- --include-ignored`：**189 个 library 节点及 122 个 integration 节点通过，0 failed、0 ignored**。日志另有测试自行启动的三个单节点结果，不作为额外实体计数。上表所列 29 个具名节点均在日志中实际报告 `ok`。首次仅复制候选目录时测试编译 exit 101，原因是缺少上述外部 fixture；补齐并绑定 hash 后重跑通过，不把首次失败称为测试通过。
- 私有过程日志的 SHA-256：matrix `cbee2c3e73e4206304c140c53bba058b9f7e416320efc034f88c86c6740c6296`、identity `63fcb8b754b6ed27947d30731efb0b5b6ea1a4cce6aacc16576e341cf60cd360`、Cargo `a0884c91c7b2144eefbe10fa82c1e51e2358b47fcce8a4a58c118a6ac6e06e9f`；这些临时日志、私有 `.git`、fixture 副本和二进制不提交。仓库中此前对外直接调用者的可核实范围和唯一批准的孤立 UTF-16 差异见 `capability-mapping.md`；正常 emoji 与 UTF-16 preview 均在本轮实测。

结论：上述冻结快照在所列 Linux 环境下，两域 32 命令的成功路由、字段信息映射、代表失败/恢复和事务边界形成可核对证据，联合 CLI 契约在该限定范围内可接受。该结论不证明所有可能参数组合，也不替代 Windows 原生、冻结目标 Ubuntu 22.04、候选 CI、账本、性能及发布验收。测试证据 Case、完整 Gate 与相关变更仍由各自 owner 对账。

### 字段审计期间发现与处置

- DR `archive` 未记录历史确认和 `mark-aligned` 非法状态曾缺少可执行恢复；修复后冻结快照直接核对单/双对象历史 ID、确认参数、非法状态与零写。
- IR `discard` 拥有资源但未确认删除曾缺少目标与确认建议；修复后冻结快照直接核对原因、授权参数、零写及带资源 ID 的真实删除。
- DR `publish/evolve` 预检曾丢弃底层历史诊断；修复 CLI 投影后，冻结快照真实 `publish --preflight` 核对未记录 ID、关系类型、确认建议和零写。正式提交后的成功 review 只在验收成功时输出；故障的计划/实际界线由上文 T 对应节点验证。

报告写入后运行仓库公共 `bun run check`：quick 的 6 项通过、67 项未选择；它不替代领域 scope、全仓或双平台门禁。
