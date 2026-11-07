# Record CLI 候选机器协议

本文供调用者和维护者理解两个原生 CLI 的 JSON、结果和恢复边界。领域行为及授权仍以 [Decision Records CLI](../../skills/decision-records/references/cli-operations.md)、[Investigation Report CLI](../../skills/investigation-report/references/cli-operations.md) 和[共同操作模型](../record-operations/model.md)为准；参数、默认值及命令的域差异用各二进制 `help <command>` 查询。候选的构建、隔离与验证从 [README](README.md) 进入。这里描述候选接口及其应保留的信息，并不把源码映射当成跨平台或全部分支已验收的证据。

## 通道与 envelope

请求 `--json` 时，正常情况下 stdout 是单个 JSON 对象，stderr 承接警告或非协议诊断；退出码 0 为成功、1 为领域或系统失败、2 为参数错误。help 和 version 是独立的文本入口。解析器已识别 JSON 请求但无法判定命令时，失败对象的 `command` 可以为空字符串。输出自身发生序列化或 I/O 故障时不能假设一定得到可解析对象。

除成功 trace 外，成功对象含 `version: 1`、`command`、`ok: true`、`result` 和 `diagnostics`；失败对象含 `version: 1`、`command`、`ok: false`、`error` 和 `diagnostics`，有实际可证明部分事实时还可含 `result`。`error` 包含 `code`、`message`，可带 `path`、`field`、`recovery`；诊断可带 `code`、`message`、`path`、`target`、`reason`、`recovery`、`causeCategory`、`operation` 和 `detail`。成功输出的诊断数组可以为空，warning 亦可能在结果内并写 stderr，不能只检查其中一个通道。失败时先读 `error` 和诊断，再读存在的部分结果；不得把 absent、`null`、空数组或 false 当成同一含义。仅在来源分支有相应事实时输出可选字段；明确未知的 `null` 保留为未知。

诊断的 `path` 用于定位实际问题，可为平台显示的规范路径；它不等同于记录结果中表示逻辑来源的 `sourcePath`，调用者不应假定两者字面相同或采用相同的相对路径基准。

成功 `trace --json` 不套 envelope：DR 带 `source`，IR 带 `warnings` 且 warning 同时写 stderr；两域均保留各自原有字段、类型、顺序、缺省及预算语义。失败 trace 使用失败 envelope，不将其说成旧版同形。`version` 是候选 envelope 版本，不是索引 schema 版本；需破坏现有机器契约时应先审查并调整版本。实现入口为 [protocol.rs](src/protocol.rs) 和 [输出映射](src/cli/output.rs)。

## 命令结果和信息归属

表中字段是定位和验收的代表性信息，不是可替代源码的完整 JSON Schema。具体字段、序列化名及可选条件以列出的 Rust DTO/输出映射为准；对应领域现行 CLI、结果类型与事务规则是兼容性预期的独立来源。覆盖目标是保留用户依赖的程序化信息，而非把未使用的 TS SDK 签名机械转成 CLI。不能由任一源码声明单独推断所有旧新分支已等价。旧领域细粒度字段及其验收来源见[兼容验收清单](compatibility.md)。

| 命令 | 结果及映射 owner |
| --- | --- |
| 两域 `candidates`、`show-candidate` | DR 的 `records` / `record`、正文及 readiness；IR 的 `candidates` / `candidate` 包含 `id`、`path`、`markdown`、诊断和 `readiness`。见 [DR DTO](src/queries/decision/candidates.rs)、[IR DTO](src/queries/investigation/candidates.rs)。 |
| 两域 `check` | `scope`、`checkedIds`、索引和错误；DR `summary`，IR `availableReportCount`、`selectedReportCount`、`indexChecked` 按适用分支存在。见 [CheckResult](src/mutations/check.rs)；局部检查不证明全集。 |
| 两域 `list` | DR `records`、`source`、`appliedFilters`、`facets`；IR `entries`、`indexPath`、筛选及 facets；两者包含窗口、`total` 和 warning。见 [DR DTO](src/queries/decision/list.rs)、[IR DTO](src/queries/investigation/list.rs)。 |
| 两域 `show` | DR 的完整 `body`、`record`、warning；IR 的 `id`、`markdown`、`state`、`indexPath` 和诊断。见 [DR DTO](src/queries/decision/show.rs)、[IR DTO](src/queries/investigation/show.rs)。 |
| 两域 `search` | DR `records`、IR `entries`；各结果保留筛选关系、metadata 命中字段/关系或 content `previews`（含位置、范围），以及 `searchInfo` 的 query、source、counts、coverage 和适用截断信息。见各域 [DR content](src/queries/decision/content.rs)、[DR metadata](src/queries/decision/metadata.rs)、[IR content](src/queries/investigation/content.rs)、[IR metadata](src/queries/investigation/metadata.rs) 与[共享搜索信息](src/queries/search_info.rs)。 |
| 两域 `trace` | `anchorId`、`direction`、`limits`、`coverage`、`traceIds`、`contextIds`、`frontier`、可选 `blockedEvent` 和各域 `entries`；域差异见上节和 [DR DTO](src/queries/decision/trace.rs)、[IR DTO](src/queries/investigation/trace.rs)。frontier 不是 cursor。 |
| 两域 `new` | 创建身份、路径、readiness、warning 及事务事实；DR 还提供 `decisionId`、可选 alignment preview。提交后失败仍可能已创建，不把 `ok: false` 当作零写入。见 [身份输出](src/cli/identity_output.rs)。 |
| 两域 `publish`、`set-relations`，以及 DR `evolve` | 按操作保留选中或建立/归档身份、`preflight`、`relationReview` 及事务结果；review 的 `phase` 区分预检与提交后，source 保留 before/after 和 action。见 [DR mutation 映射](src/cli/mutation/decision/services.rs)、[IR mutation 映射](src/cli/mutation/investigation/services.rs)、[evolve 映射](src/cli/identity_output.rs)。 |
| 两域 `discard`、`rename` | 分别保留选择身份、实际影响、确认或恢复事实，以及 rename 的旧新身份、路径、影响与候选/资源归属信息。预检只表达计划。见 [DR 身份映射](src/cli/decision_identity.rs)、[IR 身份映射](src/cli/investigation_identity.rs) 和[共同事务输出](src/cli/transaction_output.rs)。 |
| 两域 `sync-index` | 区分 full / selected、preflight / 实际执行、`changedIds`、所选 ID、索引位置、状态、warning 和适用的 `coverage`；事务分支的字段可能不同于预检 DTO。见 [DR selected](src/mutations/decision_selected_sync.rs)、[IR selected](src/mutations/investigation_selected_sync.rs)、[IR full](src/mutations/investigation_sync.rs) 和各域 mutation 映射。 |
| 两域 `stage` | 适用范围、选择、实际 `writtenPaths`、`preservedPendingPaths`、`callerOwnedPaths`；DR 另有 `indexRelativePath`、`pendingFileCount`，IR 有 `indexPath`、`namespace`、`changed`、`state`。失败可含 `pending`、未知的 `changed: null` 和恢复提示。见 [stage 输出](src/cli/transaction_output.rs)。 |
| DR `archive`、`mark-aligned`、`reactivate` | 受影响 ID、原/新状态和路径，及实际事务/预检事实。见 [lifecycle 输出](src/cli/transaction_output.rs) 和 [执行映射](src/cli/mutation/decision/lifecycle.rs)。 |

rename 两域分别提供 `oldName` / `newName`、候选和正式关系改写计数及 `affectedCountsScope: "selected-and-rewritten"`；IR 另有 `affectedResourceReferenceCount`，计量所选及实际改写来源中的资源字面引用。该范围不包含未选候选，不为计数读取或改写它们。DR rename 对域内 Git pending 执行保护；冲突或无法证明时停止，不能覆盖 pending。IR discard 成功后的 `deletedResourceIds` 与历史确认需求 `requiresRecordedDeletionConfirmation` 分开表达；预检只提供 `plannedDeletedResourceIds`。

selected sync 和 stage 的多个 selector 诊断保留各自有序的 `target`、`reason`、`recovery` 及可证明的 scope、state、`causeCategory`、`operation`、`detail`；IR `reportCount` 仅在可信 baseline 已验证后提供。没有实际 I/O 错误细节时，`detail` 省略，不伪造 Node `realpath` 错误原文。

调用者应逐分支检查结果而非依赖表中所有字段同时存在。例如 `errors` 在一个预检 DTO 中存在，不意味着每个提交或 selected 分支都提供同名字段。仓库内已核实调用包含维护命令和测试，仓库外安装副本、私有脚本和 SDK 调用不可由仓库搜索穷尽。

## 文件与事务边界

本节定义当前 Rust 候选的文件与事务契约，对应[候选文件保障决策](../../docs/decisions/261107-rust-record-candidate-cooperative-file-safety.md)；实现与测试证据以实际 revision 和 Linux 环境为限，不外推 Windows 或其他平台。候选仍只用于私有 fixture，不操作真实记录。生产 TypeScript 不随候选改变，其保障见[共同操作维护](../record-operations/README.md)。

- **更新与新建**：持合作锁，在受管路径核对完整内容与普通权限；内容或权限变化为冲突，同内容同权限的 inode 变化可接受。普通更新在同目录独占创建临时文件，完整写入并设置权限后再次比较，原子替换并回读字节与权限。最后比较到 rename 之间仍有非合作编辑竞争窗口，不是 CAS；普通编辑器也可能原子替换。新建直接独占创建，不能覆盖竞争者；普通候选创建在写入并回读验证后提交。已知替换或创建发生时记录实际写入；替换结果无法确认或回读失败时报告未知，不把 `changed: false` 当成零变化的证明。
- **路径、权限与硬链接**：保留根内目录链接规则，最终文件和资源树成员链接不跟随，越界或不能安全判定时拒绝；只读目标拒绝，不因目录可写绕过。写集内硬链接别名拒绝；写集外硬链接继续指向旧内容。特殊属性、ACL 与 Windows 全属性保真不作承诺。
- **资源与恢复**：资源先逐项独占复制到目标并验证，再更新引用和必要索引，最后重查旧源成员、字节和权限后删除；业务删除和旧源核对按内容及普通权限判断等价，不要求 inode 不变。覆盖或删除不可重建旧数据且无可验证保留副本时先独占保存并验证恢复副本；IR 的发布身份和成员是业务事实，不能仅凭正文猜测。恢复副本和操作者根据结果整理的简短对账清单是运维材料，不改变领域 schema 或权威源。失败保留已完成、未知路径、系统原因和适用备份；有后来编辑或状态无法证明安全时停止并人工对账。清理本事务拥有的临时文件或备份时仍需证明必要身份，不能仅凭内容等价删除其他对象。不引入 WAL、自动重放或强制完整自动回滚，只有完整恢复经证明才报告 rolled-back。
- **提交与暂存**：普通更新以回读通过为提交点；已有索引发布以实际替换为提交点，新建索引以独占创建并完成写入和初始化为发布点；之后验收或清理失败仍保留 committed；删除以旧路径退出为提交点，更名以目标、必要引用和索引完成及旧路径退出为提交点。多个资源移动须所有必要旧源均退出才满足该退出条件；最后目录删除已成功但其回读失败时，仍保留已知退出和适用提交事实。涉及索引发布时分别依据 `committed` 和实际、未知路径判断发布事实与旧源退出状态。Git stage 保留真实锁、备用 index、`git update-index`、锁内 HEAD/pending 检查，以及精确选择、模式和删除；保留未选暂存及未跟踪数据，真实 index 发布为提交点。Git 不是工作区备份。

## 事务、编码和恢复

预检不持久保存执行凭据，正式执行重新准备并在写锁内核对；fresh 与写后验收独立采集。事务结果的 `changed`、`committed`、`verification`、`outcome`、`writtenPaths`、`unknownPaths`、`errors` 和 `cleanupErrors` 是不同事实；适用时 `recoveryBackups`、`recoveryDirectories` 提供恢复线索。`changed` 表示已知变化，`committed` 表示已知越过提交点，均为 false 不排除 `unknownPaths` 中发生了变化；`verification` 和 `outcome` 分别说明验收与恢复状态。`writtenPaths` 是已知实际影响，`unknownPaths` 是结果不能确认的路径，两者可能同时包含同一路径。`partial-or-unknown` 或提交后清理失败不代表完整回滚；保留报告的备份和目录，检查实际状态再决定恢复，不盲目重试。`recoveryBackups` 的 `source` / `backup` 既可能指独立恢复副本，也可能在资源迁移失败时指向已验证的目标资源文件；后者是目标树的一部分，不是成功后可删除的临时备份。准备成功后事务失败时可能出现 `plannedIdentity`，它只表示已准备的计划，不等于实际 mutation；提交后结果未知、实际写集及计划分别判断。计划的路径和关系审阅不等于实际写集或已提交 review。stage 按其 pending outcome 解释，不用普通文件事务结果替代。

临时文件残留属于清理诊断，应提供实际残留路径和原因；它不表示业务目标已经替换，也不能据此把业务目标记为已写入。

源文档和索引文本中的孤立 UTF-16 代理项被结构化拒绝，不静默替换；正常文字和完整 emoji 不受影响。预览按 UTF-16 code unit 截断时仍须保留原 JSON 输出契约，包括截断产生的转义代理项。安全和并发能力依实际平台与证据界定，不承诺非合作进程的跨文件原子隔离。
