# 本轮测试设计审查（Change 结束时删除）

范围：`tools/record-cli/tests` 的集成节点及 `delivery.test.ts`，本轮修改的 Cargo 快照、Gate 测试节点；产品模块内联单元测试不在写权限内。以下索引按 Cargo target 和 `module::test` 命名；跨平台条件在节点内部表达，Windows 与 Unix 分别执行真实适用观察。下表的准入不是运行通过或完整 32 命令验收证明。各组成员的精确清单见末节；同组内输入、观察不同之处以各名称和测试体为准。

## 候选裁决

以下准入均同时满足：**有效性**依靠私有工作区中显式输入和契约可观察事实（而非把测试名或被测代码返回值当预期）；**价值**是对应受管记录、使用者输出或数据保护的现实错误；**形态**在声明的责任边界运行，只有 Git 历史/index/锁、真实进程通道、平台文件系统等不能降层的事实才使用真实资源。结果是保留，不表示测试将所有领域场景穷尽。

| 成员组 | 限定责任、区分输入及观测；形态裁决 |
| --- | --- |
| `authoring::create` | 新候选首次创建、已存在不覆盖、无效输入不建立集合、两域首建、未就绪 scaffold 与已有未引用资源；观察提交、readiness、文件与原字节。事务层直接执行，避免每个规则都启动 CLI。 |
| `authoring::publication` | IR 多候选关系闭合、未选坏正文、已有资源、未就绪及重复 ID 的零写；直接看事务结果、文件、警告。关系历史 warning 需要真实 Git：尝试去掉 Git 后该独立警告断言失败，恢复基线，不误把它当多余 E2E。 |
| `authoring::publication_freshness` | 事务 fresh 时所选正文漂移必须中止；索引作为未选正式身份事实时不读取损坏/缺失正文，未引用资源保持。注入时序在真实文件边界，仅对 symlink 变体限定 Unix。 |
| `authoring::selectors` | 后缀归一、完整 ID 与歧义、两域新建关系的日期 ID 和未消歧失败；直接预检/事务及解析文件结果。提取重复关系输入构造，未把领域差异压成单一结果。 |
| `decision_authoring::publication` | 预检不写、归档前序、拆分闭合、无变化和分组关系；观察源文件、已提交状态及独立预期关系。fixture-only 事务比全部真实 Git 便宜且保留其职责。 |
| `decision_authoring::history_and_identity` | HEAD 已记录与未记录前序、歧义 selector 与无写；历史事实必须真实 Git，歧义在本地 fixture 验证。 |
| `identity::established` | 正式 rename/discard/noop、日期、引用重写、stale 和 Git 历史不可用；比较记录、索引、Git pending 与错误。用事务直测真实写集和 fresh；历史确认节点保留 Git。 |
| `identity::candidate` | 草稿操作不得错误写正式索引、未完成正文 no-op、缺失索引 fail closed、旧身份同路径更新及已记录/历史身份确认；有历史前提者保留 Git，其余隔离文件。 |
| `identity::cli`、`investigation_identity` 的 `cli_rename_preflight_and_execution_are_distinct` | 实际二进制 argv、preview 与执行分离及磁盘变化；不是用事务测试替代进程接线，也不要求同一测试覆盖所有命令。 |
| `investigation_identity` 其余节点 | 候选 no-op、删除授权、正式引用、共享资源 owner、实际资源漂移、旧 ID、Git 历史索引、ignored 文件；真实文件/索引及必要 Git 可观察，资源迁移节点在 Unix 检查 mode/umask，在 Windows 检查只读属性。 |
| `queries::snapshot_queries`、`metadata_search` | 手写 v4 投影的 list 默认过滤/facets、分页、关系事件整体预算、show 当前正文与 stale、metadata 搜索完整计数及匹配证据；期望由领域查询契约明确给出，运行投影/API 而不是扩大为所有真实进程。 |
| `queries::content_search` | 匹配数/隐藏结果与 coverage、预览 UTF-16 截断保留代理项转义、非法源失败、源 JSON 孤立代理项结构化拒绝和 selector 诊断；后两项用真实二进制验证通道。保留预览中允许的转义与源输入拒绝的不同边界。 |
| `queries::candidates` | 直接声明身份与 locator、坏 scaffold/重复 ID、丢失依赖、资源引用/owner/ignored/symlink/case；真实临时资源与必要 Git 管理集合。Unix symlink 与 Windows junction 分别验证受引用重解析边界，不相互冒充平台通过。 |
| `queries::check` | 两域 CLI 聚合错误、选中范围，以及 DR 来源与索引差异、IR 代理项输入错误；直接解析 stdout 和退出，验证分部结果不冒称全集。 |
| `git_stage::read_git` | 固定 HEAD、pending/worktree 区分、缺失对象、冲突 stage、路径/仓库安全与外部 Git 不可用；真实 Git index、refs 和对象损坏是不可由文件替身证明的语义。 |
| `git_stage::publish_git` | 条件发布的旧 pending/worktree 保留、写入删除及 mode、busy/stale、锁所有权、竞争者和 guard abort；真实 Git 锁/index 是责任，不以 mock 替代。 |
| `git_stage::stage_index` | 两域选中索引投影、未选 pending、已删除 pending、unborn 初始索引；独立写入 HEAD/pending/worktree 赋不同值并从 Git 读回。 |
| `git_stage::stage_decision` | DR all/domain 的选中正文、删除、pending-only locator、历史旧路径、非法源保持；真实 index 中不同阶段内容及不相关 pending 是关键输入。 |
| `git_stage::stage_investigation_sources`、`stage_investigation_resources` | IR 资源树存在/缺失、受管/ignored、foreign owner、已删树及 pending-only 定位；以真实 Git 状态与文件字节检查，而非字符串路径模拟。 |
| `git_stage::stage_history` | HEAD 索引缺失时 DR 歧义/正式成员不得冒充空历史；IR 只在可证明为候选时放行；空 namespace 正例；检查拒绝代码、pending 不变，须真实 commit。 |
| `decision_flow` | flow YAML 发布保留 BOM/CRLF 及未改字节、索引使用实际输出；rename 更新身份并保持其他字段/正文。原来把双引号作为固定格式锁定不符合语义，替代断言接受三种合法常见标量表示。fingerprint 在这里仅证明写后内容接线，不单独证明算法正确。 |
| `cli_entry` | help 不依赖工作区；参数错分别经两域查询/写入口退出 2 且 stdout 单个 JSON；受控提交失败中预期计划与实际写入区分。真实进程不可由事务函数取代，Unix 文件大小限制和 Windows 共享句柄是不同平台注入。 |
| `delivery.test.ts` 三节点 | manifest 身份/schema、字节校验、部分替换回滚与无关文件、破损/越权目标零写；独立 fixture 字节及实际文件比较。stub bytes 仅测安装协议，不证明已安装二进制能启动，该证据由 `verify-real.ts` 承担。 |
| Cargo snapshot 两个新增节点 | 合法 Cargo 清单同名跨 target / ignored 应可精确选择，坏/重复 listing 应失败。真实临时 Cargo package 是验证 metadata 与原生枚举的最低边界；增强断言完整 target/name/selector 而非仅检查 `--exact`。 |
| Gate 本轮变更节点（末节列出） | scope/catalog/运行预算的实际选择与汇总、Rust 文件收集与指标、完整 Cargo 命令；独立临时代码触发通过/失败，检查测试子目录使用测试阈值。Cargo 原仅断言最后参数，现补完整 toolchain、manifest、锁、targets 和 ignored，避免错误工作区或 target 假绿。固定 check 数用于本轮汇总对账，增删 catalog 时须同步，不能单靠数量证明选择正确。 |

## 交付与边界

- 大型 `git_stage` 拆为 Git 读取、条件发布、index、DR stage、IR 源与资源、历史基线模块；`authoring`、`decision_authoring`、`identity`、`queries` 按责任拆模块。Cargo target 不变，但节点名称带模块前缀；**所有受影响 Case 必须用最终 Cargo snapshot 重采并逐意图对账**，不得按旧 ID 直接复用。拆分后未因规模删除保护。
- 列表、事务、Git、CLI 各有不同责任，不把相同输出当重复；未把每个案例都升级成真实 Git。无关生产功能、账本和内联单元测试未在此修改。
- 此审查不是 P1 的 32 命令参数/成功结果联合验收。最小充分组合是：领域/API 规则与事务（含 fresh/postverify/recovery）、必要真实 Git 和源边界测试，加分别验证 argv/JSON 单对象/退出状态/输出通道的真实二进制调用。当前成功出口仍未对 32 条逐一完成联合映射；最终矩阵 owner 在稳定版私有工作区逐条核对，尤其不能用共同 error 出口替代各命令成功字段和通道。
- 待联合逐项对账的命令集合是两域各自的 `candidates`、`check`、`discard`、`list`、`new`、`publish`、`rename`、`search`、`set-relations`、`show`、`show-candidate`、`stage`、`sync-index`、`trace`，另加 DR `archive`、`evolve`、`mark-aligned`、`reactivate`。这是尚未完成联合证明的集合，并非断言这些命令各自没有测试。
- 平台实际通过状态以原生对应 runner 为准；本机 Unix 节点、symlink/mode 与 Windows 原生句柄节点不能互证。最终汇总另列实际执行、跳过和平台证据；跨编译不算 Windows 原生测试。

## 精确候选清单

以下每个名字是对应 Cargo target 的原生 test 节点；同一 `module` 行的成员逐一适用上表该组依据。此清单是审查定位，不替代最终 snapshot 与 Case。

- `authoring::create`：`creation_is_atomic_and_does_not_overwrite_existing_candidate`、`investigation_unready_scaffold_is_still_created`、`new_investigation_reports_preexisting_unreferenced_owner_resources`、`first_collection_is_created_with_its_candidate_in_both_domains`、`invalid_candidate_input_never_creates_candidate_or_collection`。

- `authoring::publication`：`publish_batch_closes_relations_without_reading_unselected_body`、`first_publish_keeps_owned_resources_at_final_location`、`unready_publication_and_preflight_are_zero_write`、`publication_rejects_duplicate_candidate_identity_without_writes`。

- `authoring::publication_freshness`：`publication_fresh_rejects_changed_selected_body_before_writing`、`publication_uses_formal_index_not_unselected_bodies_or_unreferenced_resources`。

- `authoring::selectors`：`publication_selector_normalizes_suffix_and_preserves_ambiguity`、`new_relation_selectors_normalize_suffix_and_reject_ambiguous_names`。

- `decision_authoring::history_and_identity`：`unrecorded_git_predecessor_requires_confirmation`、`recorded_predecessor_is_identified_from_head_index`、`legacy_name_ambiguity_rejects_every_selector_role_without_writes`。

- `decision_authoring::publication`：`first_publish_preflight_and_unselected_invalid_body`、`publish_successor_archives_predecessor_in_new_directory`、`split_requires_complete_successor_graph_and_fails_without_writes`、`unchanged_evolution_still_uses_preflight_and_no_commit`、`grouped_relations_bind_to_successors_and_discard_candidate`。

- `identity::candidate`：`decision_candidate_rename_and_discard_keep_published_index`、`decision_recorded_candidate_rename_requires_confirmation`、`decision_candidate_noop_checks_identity_without_normalizing_bad_body`、`decision_candidate_only_collection_does_not_create_an_index`、`decision_candidate_reusing_historical_formal_id_requires_confirmation`、`decision_legacy_candidate_same_path_identity_update_commits`、`decision_missing_index_with_formal_source_rejects_candidate_mutation`。

- `identity::cli`：`decision_cli_preflight_rename_and_discard_are_real_transactions`。

- `identity::established`：`decision_formal_rename_noop_date_and_discard`、`decision_recorded_requires_confirmation_and_preserves_git_pending`、`decision_fresh_detects_source_drift`、`decision_rename_rewrites_index_visible_referrer_and_rejects_stale_source`、`decision_history_unavailable_fails_closed_before_any_write`。

- `queries::candidates`：`candidate_header_distinguishes_bad_scaffold_duplicate_identity_and_surrogate`、`investigation_candidate_parser_accepts_candidate_locator_without_formal_path`、`investigation_candidates_ignore_unmanaged_git_resources_but_do_not_hide_managed_ones`、`investigation_candidate_list_and_show_discover_declared_identity`、`decision_candidates_discover_and_warn_about_missing_dependency`、`investigation_candidate_owned_resource_is_checked_without_loading_ignored_siblings`、`investigation_candidate_shared_resource_requires_owner_direct_reference`、`investigation_candidate_referenced_symlink_is_a_resource_issue`、`investigation_candidate_reports_resource_case_mismatch_without_accepting_alias`、`investigation_candidate_empty_section_keeps_identity_and_line_diagnostic`。

- `queries::check`：`decision_check_cli_reports_source_and_index_state_not_index_only`、`decision_check_cli_keeps_aggregated_diagnostics_and_partial_scope`、`investigation_check_cli_keeps_aggregated_diagnostics_and_partial_scope`、`investigation_check_cli_reports_unsupported_surrogate_in_source`。

- `queries::content_search`：`investigation_content_search_counts_hidden_hit_and_exposes_preview_ranges`、`decision_content_preview_serializes_lone_surrogate_without_replacement`、`investigation_content_search_fails_on_invalid_selected_source`、`investigation_content_search_stops_after_first_hidden_hit_and_reports_lower_bound`、`cli_rejects_unpaired_surrogate_with_actionable_structured_error`、`investigation_search_failure_preserves_failure_kind_without_fake_counts`、`investigation_trace_cli_selector_failure_identifies_selector_and_recovery`。

- `queries::metadata_search`：`investigation_metadata_search_counts_all_matches_before_limit`、`decision_metadata_search_preserves_match_evidence_and_exact_counts`。

- `queries::snapshot_queries`：`investigation_list_filters_pages_and_keeps_full_snapshot_facets`、`decision_list_default_filter_and_facets_include_archived_records`、`investigation_trace_blocks_a_split_as_a_whole`、`decision_trace_preserves_original_success_shape`、`investigation_cli_json_list_and_missing_index_are_separate_outcomes`、`show_reads_selected_utf8_checks_identity_and_reports_stale_revision`、`decision_show_rejects_mismatched_identity_and_keeps_current_body`、`decision_trace_blocks_full_reallocation_event`。

- `git_stage::publish_git`：`conditional_publication_preserves_other_pending_and_worktree`、`conditional_publication_rejects_stale_pending_and_busy_lock`、`conditional_publication_deletes_adds_and_keeps_unchanged_entries`、`source_guard_conflict_is_observed_while_real_git_lock_is_held`、`source_guard_abort_cleans_owned_git_lock_without_publishing`、`noncooperative_index_change_during_guard_is_detected_and_preserved`、`replaced_lock_is_never_deleted_as_if_owned`、`conditional_publication_preserves_requested_git_symlink_representation`、`disabled_filemode_preserves_pending_executable_representation`。

- `git_stage::read_git`：`fixed_head_and_selected_content_preserve_unrelated_pending`、`selected_invalid_path_fails_without_writes`、`unread_unselected_blob_does_not_block_selected_content`、`revision_file_uses_fixed_commit_and_literal_path`、`selected_unmerged_rejected_unselected_unmerged_preserved`、`managed_membership_from_nested_workspace_keeps_tracked_missing_and_excludes_ignored`、`fixed_revision_membership_does_not_open_unselected_or_selected_blobs`、`head_probe_distinguishes_unborn_commit_and_corrupt_ref`、`stage_root_discovery_distinguishes_nonrepository_from_broken_git_metadata`、`stage_cli_does_not_treat_missing_git_executable_as_nonrepository`。

- `git_stage::stage_decision`：`decision_source_scopes_stage_selected_document_and_preserve_unrelated`、`decision_all_scope_stages_selected_deletion_without_touching_other_pending`、`decision_all_selects_dated_pending_only_locator_without_scanning_other_blobs`、`decision_all_uses_pending_index_to_remove_third_old_location`、`decision_all_resolves_pending_only_name_from_selected_payload`。

- `git_stage::stage_history`：`historical_missing_index_is_not_treated_as_empty_for_ambiguous_or_formal_members`、`historical_empty_namespace_without_index_allows_selected_index_stage`。

- `git_stage::stage_index`：`index_scope_refreshes_selected_id_over_pending_baseline`、`investigation_index_scope_preserves_unselected_pending_projection`、`index_scope_refuses_deleted_pending_index_without_restaging_it`、`index_scope_stages_in_unborn_repository_without_existing_index`。

- `git_stage::stage_investigation_resources`：`investigation_foreign_resource_requires_pending_match_only_for_all_scope`、`investigation_all_stages_deleted_owner_tree_when_directory_is_missing`、`investigation_all_selects_pending_only_name_from_canonical_locator`。

- `git_stage::stage_investigation_sources`：`investigation_source_scopes_stage_when_resource_root_is_proven_absent`、`investigation_source_scopes_stage_managed_owner_tree_and_ignore_extras`。

- `investigation_identity`：`candidate_first_collection_rename_discard_and_resource_modes`、`candidate_noop_does_not_validate_incomplete_body_or_touch_unselected_candidate`、`published_rename_updates_referrer_and_discard_rejects_references`、`resource_freshness_detects_payload_drift_after_preparation`、`git_recorded_candidate_requires_explicit_confirmation`、`legacy_candidate_same_path_identity_update_commits`、`malformed_head_index_never_becomes_empty_history`、`cli_rename_preflight_and_execution_are_distinct`、`discard_candidate_with_incomplete_scaffold_and_unreferenced_owner_resource`、`published_resource_owner_move_rewrites_shared_links_and_rejects_shared_discard`、`ignored_owner_file_is_never_deleted_as_managed_resource`、`cli_owner_move_preserves_resources_and_platform_metadata`。

- `decision_flow`：`publish_flow_yaml_preserves_untouched_bytes_and_indexes_actual_output`、`rename_flow_yaml_preserves_other_members_and_body`。

- `cli_entry`：`invalid_query_and_mutation_arguments_use_single_json_object_and_usage_exit`、`missing_command_is_usage_error_and_explicit_help_needs_no_workspace`、`identity_failure_reports_prepared_plan_separately_from_actual_writes`。

- `delivery.test.ts`：`strict manifest binds roles, file names, target and digest`、`install verifies bytes and rolls back actual replacements while preserving unrelated files`、`invalid identity, corruption and unsafe destination fail before writes`。
- `snapshot.test.ts`：`Cargo native inventory distinguishes targets and includes ignored nodes`、`Cargo inventory rejects malformed or duplicate native listing`。
- `vibe-check-cli-performance.test.ts`：`CLI enforces only quick budgets including entry and late report overhead`。
- `vibe-check-code-coverage.test.ts`：`record-rust scope selects Rust product and test files and analyzes functions`、`record-rust file metrics report actual Rust code lines`。
- `vibe-check-native-selection.test.ts`：`native file selections exclude historical content and authoring candidates`。
- `vibe-check-scope-selection.test.ts`：`selected scopes execute only the necessary set subscriptions and dependency closure`。
- `vibe-check-definition.test.ts`：`gate Definition keeps the complete catalog and incremental selection`、`gate Definition keeps scheduler, output, and release DAG contracts`。
- `vibe-check-semantic-catalog.test.ts`：`semantic Gate catalog matches its aggregate native entry points`、`semantic commands retain native store, version-control and retired performance entry policies`。

## 第二阶段：native 单元节点候选审查

范围为本轮 `tools/record-cli/src` 中所有 `#[test]` 节点（含实际文件/Git 的模块级测试）；下方按源码文件列明当次成员。此处不修改 native 单元，source/transaction 仍由其 owner 并行调整；最终账本以冻结后 runner 快照重采，尤其按 `move_preserves_platform_metadata_and_bytes` 的 Unix umask/mode 与 Windows attributes 分别描述，不把前者记作 Windows 证据。所有组逐成员按实际输入及观察核对，以下是共同三门槛与独有责任；精确成员在紧随的清单中。

| 候选组（路径相对 `tools/record-cli/src`） | 准入裁决：有效性、价值与形态 |
| --- | --- |
| `cli/tests.rs`、`cli_mutation/tests.rs` | 内联赋值、成组关系、重复参数、bootstrap 竞争及失败结果恢复事实，以明确 argv、竞争文件和结果字段观察；命令接线/可恢复诊断是独立责任。局部解析与注入无需为每分支起子进程。 |
| `domains/decision/tests/frontmatter.rs` | 块/flow YAML 的 BOM、CRLF、注释、锚点、引用、非选字节，以及 scaffold/body/lifecycle 的合法和拒绝；手写输入与输出独立判定，文档无损编辑与发布依赖，纯函数优于事务 E2E。serialize roundtrip 只证明解析/序列化配合，不单独证明外部格式。 |
| `domains/investigation/tests/frontmatter.rs` | 固定格式、日期、身份、局部替换、正文与资源树归属；手写有效/无效输入和不相关字段，语义规则是 IR 消费边界；只有资源树归属使用私有文件。 |
| `domains/tests/*.rs`、`index.rs`、`git/tests.rs`、`source_revision.rs` | 两域 schema、图闭合和资源 owner、选择器、日期、孤立代理项与 Git pending 身份、领域换行；手写合法/非法例及元数据固定 digest。简单计算用单元，避免 Git/CLI；source fingerprint 换行对照本身不证明哈希算法，DR/IR stage 手工构造 SHA 预期另验证消费接线。 |
| `queries/{matcher,preview,relation_filter,facets,trace/tests}` | NFKC 与小写/UTF-16 原始范围、裁剪、同一关系边、时间 facets、事件预算和 frontier；直接常量期望可拦截与消费者不同的错误，纯计算适合低成本单元。preview 输出的孤立项是允许的截断而非允许源数据孤立项。 |
| `mutations/{candidate,lifecycle,publication,relations,rename,selected_sync}` 及其 tests | 候选路径、生命周期、批量目标、完整替换/清空、rename/noop、选集组合图；显式结果/错误和关系 review，局部纯计划测试与域图验证分开，避免以产品实现重算预期。 |
| `mutations/{check,decision_history,decision_lifecycle,decision_operation,decision_relations,decision_selected_sync,decision_sync,discard,evolution,full_sync,identity,investigation_operation,investigation_relations,investigation_selected_sync,investigation_sync,authoring/decision}` 下的 tests | 实际选集、资源与图验证、历史确认、preflight/fresh/verify、局部替换、写前回滚/提交后恢复和当前索引；独立 fixture 字节、真实阶段注入与明确 outcome 是证据，单域操作边界保留，不因类似输出与 CLI smoke 相互替代；真实 Git 只用于历史或 visibility。 |
| `resources/tests.rs`、`source/tests/{capture,resources}.rs` | 受选/未选、严格 UTF-8、路径与 case、预算、缺失父链、root/owner、持有锁、rival 替换；检查真实私有文件/链接、观察字节及错误，不使用 mock 冒充文件身份。Windows/Unix 的条件分支各有明确观察，必须原生执行各自分支。 |
| `source/directory_move/tests/mod.rs` | tree move 与恢复、目标竞争、syscall 前后未知、父目录替换、平台属性及字节；带时点注入的私有文件系统操作具独立数据安全价值，直接文件测试低于全 CLI。Unix restrictive umask 和 Windows attributes 是不同证明点。 |
| `transaction/tests/{freshness,outcomes}.rs` | prepare/fresh/verify 顺序、no-op、排他创建、提交点前后、计划值与实际 outcome；注入阶段故障并读真实文件/竞争者，承担共享事务责任，不能拿领域 mock 的“成功”替代。 |
| `transaction/tests/{backups_namespace,candidate_and_modes,parent_guards}.rs` | journal 实际成员、缺失父链、同路径候选提交、mode 不一致与恢复备份；分别观察 winner、backup、unknown、commit 与 verification，真实私有目录及故障时点不可省；Unix mode 与 Windows 属性观察不同。 |
| `transaction/tests/{owner_tree_moves,owner_tree_races,rename_and_resource_move,resource_recovery}.rs` | 原子目录移动、碰撞、syscall 状态不确定、提交前恢复、提交后不回滚、资源父目录替换及持久备份；对比两侧字节与 outcome，而非仅检查 error。重型 fixture 仅用于事务边界，低层目录单元不取代事务编排。 |
| `stage/tests.rs` | pending 投影合成的选中增删与未选保留、集合变化和删除索引拒绝；以人工构造的 index 预期检验纯组合；真实 Git 行为由上文 stage 集成组另行验证。 |

### 第二阶段处置与观察

- 5 处集成重复是相同测试数据/准备责任：抽取 IR 创建输入、IR stage 手算 index、historical index fixture、空 DR HEAD index fixture、IR 受限搜索准备；未合并独立原生测试或移除独立断言，不用被测函数生成 hash 预期。
- 已独立复核 safety owner 的 `RecordExitFault`：具名 fixture 仅表示删除原记录之后、索引发布之前的故障；`CopyThenDelete` 保持新写→旧删→索引及 rival 与非 rival 两种结果，`DeleteUnderReplacedParent` 保持旧删→索引和 barrier 后替换父目录。两节点分别以实际字节、恢复状态和竞争者验证独立责任，复用此有限 fixture 比维护两份故障事务成本更低；节点与 Case 意图不因 helper 合并变化。
- 真实 OS 非 Unicode argv 节点的 exit 2、单 JSON、错误码及无 panic 能区分原先崩溃/空输出；Unix `0xff` 与 Windows 未配对 UTF-16 各自实际分支，Windows 需原生执行。root 已按 architecture 裁定：可识别命令必须保留；该节点覆盖普通 `list`、分离和内联 `--root` 之后的 `list`、以及无法识别命令四种输入。原固定空串断言退出，以保留可识别命令的独立预期替代；CLI 同步后 Linux 4/4、Windows target tests 交叉检查通过，后者不证明原生行为。
- domain owner 修改 `content_search` 的 `DecisionFilters` / `FormationRange` 构造，实际断言、输入和选择语义未改；定向 31 节点通过，不将类型改造记为额外产品行为证明。
- 本次定向执行 authoring 13、queries 31、git_stage 35、cli_entry 4 全部通过（Linux）；`cargo test --lib -- --include-ignored` 实际运行 179 个 native 节点、179 通过。repository-code scope 中本切面集成文件的重复/文件/函数 finding 为零，整 scope 仍因其他 owner 的 native 测试重复和生产指标失败。该轮结果不能替代冻结后完整 Gate 或 Windows 原生。

### native 节点精确清单（审查时快照）

下面列出的节点名用于追踪裁决范围；完整实体 target 与路径仍由最终 Cargo 快照提供，而不是从文件名推导。

- `cli/tests.rs`：`query_accepts_inline_values_but_not_values_for_flags`、`new_lock_parent_bootstrap_reports_partial_and_preserves_foreign_entry`、`new_bootstrap_does_not_remove_a_competing_lock`、`transaction_failure_keeps_backups_unknown_paths_and_withholds_review`。

- `cli_mutation/tests.rs`：`inline_option_values_preserve_relation_equals`、`grouped_replacements_preserve_sources_targets_and_summaries`、`mutation_arguments_reject_duplicate_singleton_and_invalid_group`。

- `domains/decision/tests/frontmatter.rs`：`local_rewrite_preserves_bom_crlf_comments_anchors_and_unselected_multiline`、`relation_and_identity_rewrite_preserve_other_source_text`、`flow_mapping_publish_preserves_unselected_bytes_bom_and_crlf`、`flow_mapping_accepts_implicit_null_lifecycle_values`、`flow_relations_retain_comments_and_unmodified_members`、`flow_relations_accept_plain_apostrophe_and_escaped_single_quotes`、`flow_relations_and_identity_handle_nested_commas_and_unicode`、`rewrites_folded_value_and_quoted_key_without_touching_other_fields`、`changing_an_anchor_used_by_other_fields_fails_closed`、`metadata_replacement_preserves_body_and_validates_lifecycle`、`yaml_emitter_round_trips_and_rejects_invalid_changes`、`established_document_projects_only_when_body_and_path_are_valid`、`identity_discovery_does_not_require_a_ready_body`、`candidate_body_keeps_scaffold_and_readiness_separate`、`reads_yaml_and_rejects_duplicate_keys_and_bad_lifecycle`。

- `domains/investigation/tests/frontmatter.rs`：`established_projection_checks_utc_date_and_body`、`identity_discovery_ignores_later_invalid_content`、`owner_tree_requires_matching_capture_and_direct_references`、`identity_replacement_changes_only_selected_links_and_id`、`line_format_rejects_whitespace_after_quoted_scalar`、`canonical_frontmatter_round_trips`、`relation_replacement_is_local_and_checked`、`body_detects_empty_sections_and_resource_links`、`fixed_order_and_declared_identity_are_checked`。

- `domains/tests/index_tests.rs`：`validates_both_domains_and_rejects_corruption`、`relation_null_rejected_and_decision_summary_normalized`、`decision_graph_checks_archival_and_complete_events`、`reallocation_component_requires_both_roles_and_two_sides`、`graph_validates_relations_and_resource_owners`、`resolves_dated_ids_and_detects_ambiguous_names`。

- `domains/tests/tests.rs`：`calendar_and_names`。

- `git/tests.rs`：`pending_record_parses_representation_and_rejects_invalid_identity_or_path`。

- `index.rs`：`index_rejects_unpaired_surrogate_without_rejecting_emoji_or_literal_escape`。

- `mutations/authoring/decision/tests/mod.rs`：`precommit_failure_restores_candidate_and_index_absence`。

- `mutations/candidate/tests/mod.rs`：`allocates_canonical_domain_paths_and_rejects_conflicts`。

- `mutations/check/tests/mod.rs`：`decision_full_check_rebuilds_source_projection_not_just_index`、`investigation_full_check_rebuilds_sources_and_reports_unreferenced_resources`、`investigation_formal_resource_missing_fails_then_present_passes`、`decision_candidate_only_check_and_structured_surrogate_rejection`、`independent_bad_sources_are_aggregated_with_partial_coverage`。

- `mutations/decision_history/tests/mod.rs`：`not_git_unborn_and_missing_index_with_head_sources_are_distinct`。

- `mutations/decision_lifecycle/tests/mod.rs`：`archive_preparation_produces_selected_source_and_full_validated_index`。

- `mutations/decision_operation/tests/mod.rs`：`private_mark_aligned_preflight_and_transaction`、`private_reactivate_moves_source_and_publishes_index`、`private_archive_outside_git_and_precommit_recovery`。

- `mutations/decision_relations/tests/mod.rs`：`private_set_relations_preserves_unselected_source_scope_and_reports_review`。

- `mutations/decision_selected_sync/tests/mod.rs`：`related_expands_selected_events_but_not_unrelated_components`、`selected_sync_preserves_unread_baseline_and_requires_both_ids_for_rename`、`selected_sync_rejects_stale_required_dependency`。

- `mutations/decision_sync/tests/mod.rs`：`full_sync_preflight_fresh_and_published_index_are_distinct`。

- `mutations/discard/tests/mod.rs`：`blocks_formal_references_and_requires_resource_and_history_confirmation`、`candidate_discard_never_publishes_formal_index`。

- `mutations/evolution/tests/mod.rs`：`candidate_evolution_archives_active_predecessor_and_requires_history_confirmation`。

- `mutations/full_sync/tests/mod.rs`：`missing_invalid_equal_and_preview_are_distinct_without_claiming_writes`。

- `mutations/identity/decision/tests/mod.rs`：`failure_after_new_source_restores_old_and_index`。

- `mutations/identity/investigation/tests/mod.rs`：`competing_old_owner_prevents_rollback_and_preserves_both_sides`、`failure_before_source_write_restores_moved_owner`。

- `mutations/investigation_operation/tests/mod.rs`：`private_fixture_preflight_and_committed_relation_then_unchanged`。

- `mutations/investigation_relations/tests/mod.rs`：`changes_only_selected_relation_and_validates_before`。

- `mutations/investigation_relations/tests/normalization_tests.rs`：`orders_resolved_relations_and_normalizes_summary`。

- `mutations/investigation_relations/tests/preparation_change_tests.rs`：`selected_relation_is_written_into_domain_validated_index_without_reading_unselected_source`。

- `mutations/investigation_relations/tests/preparation_tests.rs`：`unchanged_preparation_rechecks_source_and_keeps_index_projection`。

- `mutations/investigation_selected_sync/tests/mod.rs`：`selected_sync_preserves_unrelated_source_and_requires_old_owner_absence`。

- `mutations/investigation_sync/tests/mod.rs`：`full_sync_tracks_resources_without_treating_in_place_bytes_as_index_revision`、`resource_root_appearance_between_prepare_and_fresh_blocks_publication`、`git_visibility_change_during_fresh_does_not_publish`、`unreferenced_unsafe_resource_root_is_warning_with_stable_membership_proof`。

- `mutations/lifecycle/tests/mod.rs`：`lifecycle_preconditions_and_alignment`。

- `mutations/lifecycle/tests/plan_tests.rs`：`archive_plans_every_record_and_preserves_basename_and_metadata`、`archive_does_not_approve_missing_history_or_duplicate_selection`。

- `mutations/publication/tests/mod.rs`：`batch_targets_may_refer_to_selected_candidates_but_graph_validation_is_required`。

- `mutations/relations/tests/mod.rs`：`groups_replace_completely_but_unmentioned_source_is_preserved`、`clear_is_not_preserve_and_unchanged_is_reported`、`rejects_unknown_and_duplicate_resolved_sources_or_targets`、`review_json_keeps_domain_edge_names_and_omits_absent_summary`。

- `mutations/rename/tests/mod.rs`：`target_prefers_name_then_id_without_overwriting`、`genuine_noop_does_not_request_history_but_actual_rename_does`。

- `mutations/selected_sync/tests/domain_integration_tests.rs`：`combined_projection_rechecks_real_decision_graph`。

- `mutations/selected_sync/tests/mod.rs`：`selected_change_keeps_unread_baseline_and_reports_only_observed_coverage`、`deletion_and_rename_require_explicit_selection_and_valid_combined_graph`。

- `queries/facets.rs`：`facets_use_utc_and_deduplicate_tags_per_record`。

- `queries/matcher.rs`：`all_terms_may_span_segments_but_phrase_may_not`、`whitespace_and_empty_query_are_normalized`、`lowercase_preserves_context_and_expansion`、`preview_ranges_are_original_utf16_after_nfkc`。

- `queries/preview.rs`：`preview_clips_utf16_without_replacing_unpaired_surrogates`。

- `queries/relation_filter.rs`：`filter_requires_same_edge_and_evidence_is_deduplicated`。

- `queries/trace/tests/mod.rs`：`event_budget_does_not_admit_partial_event`、`context_can_be_promoted_and_depth_boundary_is_reported`、`order_is_utf16_not_unicode_scalar_order`。

- `resources/tests.rs`：`absent_owner_is_bound_and_empty_or_case_alias_is_rejected`、`evidence_distinguishes_missing_root_and_empty_selected_owner`、`selected_git_evidence_ignores_other_owner_membership`、`selected_evidence_ignores_payload_and_other_owner_but_detects_replacement`。

- `source/directory_move/tests/mod.rs`：`moves_complete_tree_and_conditionally_restores_it`、`destination_winner_and_changed_source_are_never_overwritten`、`restore_never_overwrites_new_original_or_edited_tree`、`syscall_collision_preserves_winner_and_source`、`post_syscall_drift_is_unknown_not_owned`、`replaced_parent_and_case_alias_are_rejected`、`move_preserves_platform_metadata_and_bytes`、`edited_moved_tree_blocks_recovery`、`source_name_replaced_at_syscall_is_unknown`。

- `source/tests/capture.rs`：`native_join_preserves_workspace_path_contract`、`header_capture_stops_before_unselected_body`、`capture_checks_relative_path_and_strict_utf8`、`capture_allows_internal_directory_link_but_rejects_escape`、`bounded_capture_distinguishes_file_and_total_budget`、`missing_proof_creates_exclusively_without_overwriting_rival`、`conditional_remove_rejects_changed_source_then_removes_verified_source`、`directory_creation_and_empty_removal_preserve_members`、`resource_root_and_owner_are_proven_without_following_links`。

- `source/tests/resources.rs`：`selected_resources_reject_case_aliases_without_reading_siblings`、`selected_stat_reports_large_and_missing_members_without_payload_read`、`selected_tree_does_not_inspect_unselected_link`、`missing_proof_tracks_observed_ancestor_extensions`、`exact_mkdir_never_chmods_replacement_observed_after_creation`、`missing_proof_checks_original_and_journaled_parent_chain`、`collection_lock_is_exclusive_and_releases`、`collection_lock_never_removes_replacement`、`captures_only_the_selected_owner_tree_with_bytes`、`enumeration_reports_members_and_types`。

- `source_revision.rs`：`metadata_fingerprints_match_independent_expected_bytes`、`source_newline_rules_are_domain_specific`。

- `stage/tests.rs`：`compose_preserves_pending_unselected_and_refreshes_add_delete`、`compose_rejects_collection_change_and_pending_deletion`。

- `transaction/tests/backups_namespace.rs`：`same_mode_rival_between_recovery_mkdir_and_open_keeps_bytes_in_durable_backup`、`changed_backup_is_not_deleted_or_reported_as_verified_on_cleanup_failure`、`newly_created_namespace_accepts_only_actual_candidate_write`、`newly_created_namespace_rejects_concurrent_unjournaled_member_after_commit`、`newly_created_namespace_accepts_prior_actual_write_before_later_index_publication`。

- `transaction/tests/candidate_and_modes.rs`：`planned_but_unwritten_namespace_member_is_never_treated_as_owned`、`same_path_candidate_identity_update_commits_only_actual_updated_content`、`same_path_candidate_identity_update_preserves_commit_on_postverify_or_unlock_failure`、`same_path_candidate_identity_update_failure_before_write_is_unchanged`、`resource_owner_and_nested_directory_keep_exact_mode_when_natively_creatable`、`resource_directory_mode_copy_rejects_source_membership_drift_before_writes`、`resource_directory_mode_mismatch_preserves_old_tree_without_chmod`。

- `transaction/tests/freshness.rs`：`unchanged_requires_fresh_read_and_independent_verification`、`fresh_drift_or_unsupported_write_never_overwrites`、`publication_writes_and_independently_verifies_real_files`、`postcommit_failure_never_rolls_back_or_overwrites_rival`、`candidate_create_is_exclusive_and_existing_winner_is_preserved`、`precommit_failure_restores_only_actual_writes`、`precommit_recovery_preserves_noncooperative_later_edit`、`cooperative_transactions_do_not_prepare_at_the_same_time`、`index_publication_with_creation_commits_after_index_write`、`rename_commits_only_after_old_name_exits`。

- `transaction/tests/outcomes.rs`：`planned_value_is_retained_only_after_successful_prepare_and_never_as_success_on_failure`。

- `transaction/tests/owner_tree_moves.rs`：`owner_tree_move_preserves_directory_and_file_modes_under_restrictive_umask`、`owner_tree_move_target_winner_is_not_overwritten`、`owner_tree_move_preindex_failure_conditionally_restores_original_tree`、`owner_tree_move_postcommit_failure_keeps_moved_tree_and_verified_backup`、`owner_tree_move_recovery_never_overwrites_recreated_original_or_edited_target`。

- `transaction/tests/owner_tree_races.rs`：`owner_tree_move_syscall_unknown_never_uses_receipt_or_loses_verified_backup`、`owner_tree_move_syscall_target_collision_keeps_winner_and_original`、`owner_tree_move_source_changes_at_syscall_are_unknown_and_never_inverted`、`owner_tree_move_notstarted_collision_keeps_backup_if_original_changed`。

- `transaction/tests/parent_guards.rs`：`missing_parent_replacement_between_prepare_and_fresh_is_rejected`、`resource_nested_created_parents_extend_original_missing_proof`、`deleted_record_recovery_rejects_replaced_parent_before_creating`、`removed_resource_ancestor_replacement_fails_postverify_without_rollback`。

- `transaction/tests/rename_and_resource_move.rs`：`rename_failure_before_exit_removes_only_owned_new_file`、`index_precommit_failure_restores_removed_original_and_removes_owned_copy`、`aliases_in_the_same_plan_are_rejected_before_writes`、`unlock_failure_preserves_committed_fact_and_withholds_review`、`resource_tree_move_commits_and_reads_back_members`、`resource_recovery_preserves_unowned_directory_and_verified_backup`、`resource_recovery_keeps_later_editor_and_verified_original_backup`。

- `transaction/tests/resource_recovery.rs`：`removed_resource_recovery_rejects_replaced_parent_before_creating`、`deleted_resource_file_recovery_does_not_write_into_replaced_parent`、`pure_resource_deletion_keeps_durable_bytes_and_mode_when_directory_ownership_unknown`。

## 最终增量候选复核

下列为此前快照后的新增或扩展节点；按其实际输入、外部观察、错误影响及最小边界分别重新准入，非以新增断言数量代替举证：

- `identity::pending::{decision_rename_rejects_collection_pending_and_rechecks_before_write, decision_pending_drift_before_write_retains_only_planned_identity}`：真实 Git 的域外 pending 可用、域内 pending 拒绝、unborn、损坏 metadata、noop 与 fresh 时并发 pending；分别观察源码/索引未变、明确诊断和仅 planned 身份，保护用户已暂存工作；pending/HEAD 与重新采集只能在真实 Git 验证。保留两节点及不同阶段，不以一个 no-op 代替另一个。
- `mutations::selected_sync::tests::{selector_failures_preserve_order_targets_and_recovery, selector_validation_aggregates_invalid_and_duplicate_before_baseline}`：手写多 selector 错误、两域及混合无效/重复，检查诊断顺序、target/recovery 和代码；批量选择输入的全部可行动诊断不可由单条失败证明。纯函数即可验证，不增加 Git/进程。
- `transaction::tests::outcomes::structured_prepare_diagnostics_survive_without_changing_no_write_outcome`：prepare 有序双诊断不被事务吞掉，且仍为 no-change、未提交；旧式诊断无 target 时字段省略。阶段注入加私有目录是直接责任，不要求更重 CLI 证明。
- `mutations::authoring::decision::tests::history_diagnostics::{unrecorded_relation_reports_target_reason_and_explicit_confirmation, recorded_discard_requires_specific_confirmation, unreadable_historical_baseline_is_not_a_confirmation, unready_candidate_identifies_selected_source_and_correction}`：分别固定未记录关系、正式删除确认、不可用历史基线与未就绪候选的不同 target/reason/recovery，且检查实际源/索引不写；前三项的 Git HEAD 是历史前提，第四项用私有文件即可。不能把基线不可用误报为可确认的未记录历史。
- `mutations::authoring::investigation_publish::history::tests::unavailable_head_history_is_a_warning_with_recovery`：真实坏 HEAD index 与 IR 关系输入，观察 warning 指向路径和完整检查，且不错误建议 DR 的 `--keep-unrecorded-history`；历史必须真实 Git，本节点是 IR warning 而不是 DR 阻断重复。
- `git_stage::stage_index::{cli_unresolved_selector_reports_target_recovery_and_unchanged_pending, cli_stale_selected_source_reports_identity_path_and_sync_recovery}`：两域分别真实运行二进制，检查 target、原因/路径、恢复建议、no-change 及 Git pending 投影；后者手工计算源 fingerprint 后修改正文以确保是 stale 而非空集合。相对于局部解析，它们额外验证 CLI 投影和真实 Git 无写，保留两个不同错误入口。
- `cli::transaction_output::stage::tests::publication_outcomes_do_not_claim_no_change_after_commit_or_unknown_recovery`：显式注入 recovery unknown、已提交但未验证、已提交待清理三种状态，检查 changed null/true 与 outcome；这是输出映射层可低成本区分的独立责任，真实事务回滚由前述 source/transaction 节点承担。
- `investigation_identity::cli_resources::cli_owner_move_preserves_resources_and_platform_metadata`：Windows 分支仍先断言只读属性与字节，再对私有 fixture 使用 `SetFileAttributesW` **仅清除 READONLY** 以允许清理；不存在关闭 lint 或修改产品代码。Unix mode/umask 与 Windows 属性为不同证明点。

最终本轮 Linux 复验：native `--lib -- --include-ignored` 188/188；`investigation_identity` 12/12、`cli_entry` 4/4、`git_stage` 37/37、`identity` 15/15。Windows MSVC target all-target Clippy `-D warnings` 通过，属于交叉检查而非 Windows 原生执行。上述新增节点及分组移动后的真实完整名称须由最终 Cargo 快照和 Case owner 对账。
