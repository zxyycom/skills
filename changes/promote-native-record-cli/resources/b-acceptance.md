# B 阶段验收对照（进行中）

此表把现行承诺对应到可复查的实际节点，不是旧 TS 全 API 的逐字段等价证明，也不替代 1.5 准入。格式和恢复边界以 `delivery-contract.md`、两域现行规则及用户确认的合法 Unicode 边界为准；正式切换后仍须按 2.4 复验受影响项。

## 业务和格式（2.1）

| 现行承诺 | 已执行的最小证据 | 剩余边界 |
| --- | --- | --- |
| schemaVersion 4 / definitionVersion 11，合法记录可读，结构错误不可静默接受 | `audit.md` 的独立 AJV、旧 TS parser 与冻结 Rust DR/IR 正常与异常样例；Unicode 孤立代理项按用户决定明确报错 | 领域独立验收正在复核样例和规则差异；Schema 宽松处不能声称等价全部业务规则 |
| 两域读取真实记录、顺序与标识 | 私有真实记录副本：旧 TS 与 0.1.0 Rust list 的 DR 156、IR 101 标识和顺序一致；`candidate-afjyCj/real-linux-private-smoke/` | 不证明全部返回字段或所有写入；需结合下列节点 |
| CLI JSON、失败码与诊断 | `cli_entry.rs` 的 `invalid_query_and_mutation_arguments_use_single_json_object_and_usage_exit`、`identity_failure_reports_prepared_plan_separately_from_actual_writes`；`smoke/native.ts` 在私有 Git fixture 运行两个真实程序 | 分支只证明测试节点覆盖的参数和失败，不伪造不存在的恢复事实 |
| 候选与正式、生命周期和关系 | `authoring/publication.rs` 的 `publish_batch_closes_relations_without_reading_unselected_body`、`unready_publication_and_preflight_are_zero_write`；`decision_authoring/publication.rs` 的 `publish_successor_archives_predecessor_in_new_directory`、`grouped_relations_bind_to_successors_and_discard_candidate`；`mutations::decision_relations::tests::private_set_relations_preserves_unselected_source_scope_and_reports_review` | 以节点覆盖现行行为，不把旧 SDK 类型或已废弃多文件原子回滚当新承诺 |
| 资源归属与不读取无关内容 | `investigation_identity/cli_resources.rs` 的 `published_resource_owner_move_rewrites_shared_links_and_rejects_shared_discard`、`ignored_owner_file_is_never_deleted_as_managed_resource`；`queries/candidates.rs` 的 `investigation_candidate_shared_resource_requires_owner_direct_reference` | 实际资源归属遵循各域规则，非任意目录清理 |
| 真实 Git stage 保留未选 pending | `git_stage/stage_decision.rs` 的 `decision_source_scopes_stage_selected_document_and_preserve_unrelated`；`git_stage/stage_index.rs` 的 `investigation_index_scope_preserves_unselected_pending_projection`；真实二进制 `smoke/native.ts` | 仅对已选范围和测试中的 Git 状态证明，不作并发写入原子性承诺 |
| 写入失败的可证明结果 | `decision_authoring/publication.rs` 的 `cli_publish_write_failure_preserves_existing_source`；`investigation_identity/cli_resources.rs` 的 `cli_rename_reports_resource_move_before_later_write_failure`；`cli_entry.rs` 的计划/实际结果分离 | 顺序模型不承诺旧 TS 的全量 CAS 回滚；按实际 `writtenPaths`、未知状态和人工对账处理 |

独立复核另以 Node 26.8.2 / AJV 8.17.1 的 2020 dialect 编译两份权威 Schema，使用完整空集合输入：`schemaVersion: 4`、对应域 `namespace`、`definitionVersion: 11`、空 `metadata`、`sourceRevision.metadata: "sha256:"` 加 64 个 `a`、空 `sourceRevision.entries` 和 `entries`。两域 Schema 对有效样例接受、仅将 `schemaVersion` 改为 3 的样例拒绝；将相同字节放入独占临时目录并调用真实 A 程序 `list --json --root`，有效退出 0、无效退出 1 且 JSON 的 `error.code` 为 `invalid-index`。临时目录已清理。该最小样例不证明非空字段、Markdown、关系或生命周期；前表及 `audit.md` 的非空样例另行承接。

独立非空样例使用共同外壳 `{"schemaVersion":4,"namespace":NS,"definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":H,"entries":{"240229-example":H}},"entries":{"240229-example":STATE}}`，`H` 为 `sha256:` 加 64 个小写 `a`。两个完整状态如下；其余字段不隐式补充：

```json
{"name":"example","sourcePath":"240229-example.md","title":"Example","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":["example"],"relations":[]}
```

上述 DR 使用 `NS = decisions`；IR 使用 `NS = investigations` 和下列状态：

```json
{"name":"example","sourcePath":"240229-example.md","title":"Example","formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["example"],"relations":[],"resourceIds":[]}
```

每次复制有效样例，仅修改一项：DR 的 `status` 改为 `candidate` 或删除 `purpose`；IR 的 `relations` 改为 `[{"type":"修订","target":"230101-old"}]` 或删除 `question`。分别把完整 JSON 写入隔离根的 `docs/decisions/decision-index.json` 或 `docs/investigations/investigation-index.json`，以 AJV 2020 校验权威 Schema、以真实 A 程序执行 `<role> list --json --root <隔离根>`，并以现行 TS 执行 `node skills/<role>/scripts/<decision-records.ts 或 check-investigations.ts> --root <隔离根> list`。两域有效样例三者均通过；四项单独变异均被 Schema、原生（退出 1、`invalid-index`）和 TS（退出 1）拒绝。预期来自 Schema 必填/枚举及 IR 关系类型规则，不从 Rust 反推；临时目录已清理。首次误向旧 TS 追加其不支持的 `--json` 得到 usage 2，修正参数后上述六例通过。

上述 Rust 节点于 revision `fc37fa3b89e9d7abd5b91a1dba206104bb6edfdc` 执行 `cargo +1.98.1 test --manifest-path tools/record-cli/Cargo.toml --locked --all-targets -- --include-ignored`，11 个测试程序共 246 节点通过、0 失败，运行日志 `.log/record-native-ci/fc37fa3b-rust-tests.log`；这是当前 WSL/Linux 源码测试，不是 Windows 全量测试。六 scope Gate 的 `record-rust`、updater、package hash、publisher、代码与账本检查 24/24 通过，见 `audit.md` 所述对应 invocation；实际双平台制品与运行结果按各自 revision 单独核对。

## 私有分发接线（2.3）

| 要求 | 已有证据与边界 |
| --- | --- |
| 角色、版本、target、长度、摘要与源码错配 | `native-bundle.test.ts`、`native-manifest.test.ts`、`native-release.test.ts` 和 `candidate-package.test.ts` 的显式错误 fixture；对应公开 updater 和 runtime 测试已通过。 |
| 缺资产、路径别名、旧 updater 写前停止 | `native-archive.test.ts` 与 `release-validation.test.ts` 拒绝危险路径；`audit.md` 固定旧 updater 对缺旧 ZIP 的 fetch=0 只读探针及安装调用顺序。不能把单个错误探针扩成全部网络故障证明。 |
| 其他 skill 的基础 manifest 和 updater 保持 | `native-manifest.test.ts` 核对基础 parser 投影；`test:skill-updater` 包含通用替换、版本检查及自有文件保留；候选组合检查所有其他 skill ZIP 与冻结快照成员一致。正式 Package Skills 在 `879689ab` 仍用 TS 映射通过；当前 revision CI 另行跟踪。 |
| 独占 staging、保留已有输出 | `native-staging.test.ts` 和 `candidate-package.test.ts` 检查独占输出及已有产物不覆盖；`candidate-MyCDkj` 实际组装 28 项，四个目标资产和六个编译 recipe 校验见 `audit.md`。 |
| rolling 顺序、只退役两个旧名、Latest 与可重入 | `candidate-publish.test.ts` 的私有 remote 替身覆盖资产核验、旧名退役、manifest 最后、Latest 延后和失败重试；没有实际远端写入。真实 release 下载及隔离安装归 2.5，不是 B 的先决线上发布。 |
| 两平台真实 A/B 与干净 bootstrap | `879689ab` 的 A/B 构建及来源比较已通过；Linux 在仓库外私有目标用真实 A 二进制、新装/真实旧 ZIP 首升和显式依赖安装通过；Windows 完整 bootstrap、A→B 和缺失文件修复由 `fc37fa3b` CI 正在执行，结果未到时为缺口。 |

`fc37fa3b` 同次 pending 的私有 A 包位于 `candidate-Le4eTf`，由 A 精确转换 Rust 与 skill 版本的私有 B 包位于 `candidate-MVzfLY`；B Rust 摘要与 `879689ab` 的真实 Ubuntu 22.04 B 资产一致，不重编译。在前者的 `real-linux-smoke/` 以这两份生成包及已校验的 A/B Linux 二进制执行两角色新装、检查、A→B、移除 B 二进制后的只读检查与确认补缺、运行恢复后的 `--version` 及再次检查；两 sentinel 保持，未留旧恢复目录。脚本和日志同目录；release 为内存替身、Windows 资产为占位，本次目标位于仓库隔离 stage 且使用仓库已准备依赖，不能冒称仓库外干净依赖或真实线上安装。仓库外干净 bootstrap 与旧版首升分别见 `audit.md` 的较早私有候选证据。

## 当前不可跨越的缺口

- 独立格式与领域契约复核尚未交回；不能仅因上表列出测试就勾选 1.1 或 2.1。
- `fc37fa3b` 的双平台新 delivery、Windows 完整安装与修复和发布基础 CI 结果尚待核对；不能用 `879689ab` 的旧 Node delivery 结果替代。
- 2.2 的 Windows 占用/权限失败和恢复须以当前 revision 实际结果判断。真实 release、资产身份和隔离目标安装升级属于 2.5，不由私有 mock 或 CI 假定完成。
