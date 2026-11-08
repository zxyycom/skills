# Record CLI 机器协议

本文供调用者和维护者理解两个原生 CLI 的 JSON、结果和恢复边界。领域行为及授权仍以 [Decision Records CLI](../../skills/decision-records/references/cli-operations.md)、[Investigation Report CLI](../../skills/investigation-report/references/cli-operations.md) 和[共同操作模型](../record-operations/model.md)为准；参数、默认值及命令的域差异用各二进制 `help <command>` 查询。构建与验证从 [README](README.md) 进入。本页描述 version 2 接口；平台及行为验收以实际测试证据为准。

## 通道与 envelope

查询命令的普通成功输出为格式化 JSON 的结果对象；`--json` 成功输出为紧凑 JSON。除成功 trace 的特殊形状外，两者分别是结果对象本身和包含同一结果的 envelope，不能把整个对象的形状视为相同。普通失败的诊断输出至 stderr。

请求 `--json` 时，正常情况下 stdout 是单个 JSON 对象，stderr 承接警告或非协议诊断；退出码 0 为成功、1 为领域或系统失败、2 为参数错误。help 和 version 是独立的文本入口。解析器已识别 JSON 请求但无法判定命令时，失败对象的 `command` 可以为空字符串。输出自身发生序列化或 I/O 故障时不能假设一定得到可解析对象。

除成功 trace 外，成功对象含 `version: 2`、`command`、`ok: true`、`result` 和 `diagnostics`；失败对象含 `version: 2`、`command`、`ok: false`、`error` 和 `diagnostics`，有实际可证明部分事实时还可含 `result`。`error` 包含 `code`、`message`，可带 `path`、`field`、`recovery`；诊断可带 `code`、`message`、`path`、`target`、`reason`、`recovery`、`causeCategory`、`operation` 和 `detail`。成功输出的诊断数组可以为空，warning 亦可能在结果内并写 stderr，不能只检查其中一个通道。失败时先读 `error` 和诊断，再读存在的部分结果；不得把 absent、`null`、空数组或 false 当成同一含义。仅在来源分支有相应事实时输出可选字段；明确未知的 `null` 保留为未知。

诊断的 `path` 用于定位实际问题，可为平台显示的规范路径；它不等同于记录结果中表示逻辑来源的 `sourcePath`，调用者不应假定两者字面相同或采用相同的相对路径基准。

成功 `trace --json` 不套 envelope：DR 带 `source`，IR 带 `warnings` 且 warning 同时写 stderr；两域均保留各自原有字段、类型、顺序、缺省及预算语义。失败 trace 使用失败 envelope，不将其说成旧版同形。`version` 是CLI envelope 版本，不是索引 schema 版本；version 2 移除不再产生事实的验证与恢复状态字段，成功 trace 的特殊形状不变。实现入口为 [protocol.rs](src/protocol.rs) 和 [输出映射](src/cli/output.rs)。

## 命令结果和信息归属

表中字段是定位和验收的代表性信息，不是可替代源码的完整 JSON Schema。具体字段、序列化名及可选条件以列出的 Rust DTO/输出映射为准；对应领域规则与兼容验收材料是预期的独立来源。覆盖目标是保留用户依赖的程序化信息，而非把未使用的 TS SDK 签名机械转成 CLI。不能由任一源码声明单独推断所有旧新分支已等价。旧领域细粒度字段及其验收来源见[兼容验收清单](compatibility.md)。

| 命令 | 结果及映射 owner |
| --- | --- |
| 两域 `candidates`、`show-candidate` | DR 的 `records` / `record`、正文及 readiness；IR 的 `candidates` / `candidate` 包含 `id`、`path`、`markdown`、诊断和 `readiness`。见 [DR DTO](src/queries/decision/candidates.rs)、[IR DTO](src/queries/investigation/candidates.rs)。 |
| 两域 `check` | `scope`、`checkedIds`、索引和错误；DR `summary`，IR `availableReportCount`、`selectedReportCount`、`indexChecked` 按适用分支存在。见 [CheckResult](src/mutations/check.rs)；局部检查不证明全集。 |
| 两域 `list` | DR `records`、`source`、`appliedFilters`、`facets`；IR `entries`、`indexPath`、筛选及 facets；两者包含窗口、`total` 和 warning。见 [DR DTO](src/queries/decision/list.rs)、[IR DTO](src/queries/investigation/list.rs)。 |
| 两域 `show` | DR 的完整 `body`、`record`、warning；IR 的 `id`、`markdown`、`state`、`indexPath` 和诊断。见 [DR DTO](src/queries/decision/show.rs)、[IR DTO](src/queries/investigation/show.rs)。 |
| 两域 `search` | DR `records`、IR `entries`；各结果保留筛选关系、metadata 命中字段/关系或 content `previews`（含位置、范围），以及 `searchInfo` 的 query、source、counts、coverage 和适用截断信息。见各域 [DR content](src/queries/decision/content.rs)、[DR metadata](src/queries/decision/metadata.rs)、[IR content](src/queries/investigation/content.rs)、[IR metadata](src/queries/investigation/metadata.rs) 与[共享搜索信息](src/queries/search_info.rs)。 |
| 两域 `trace` | `anchorId`、`direction`、`limits`、`coverage`、`traceIds`、`contextIds`、`frontier`、可选 `blockedEvent` 和各域 `entries`；域差异见上节和 [DR DTO](src/queries/decision/trace.rs)、[IR DTO](src/queries/investigation/trace.rs)。frontier 不是 cursor。 |
| 两域 `new` | 创建身份、路径、readiness、warning 及事务事实；DR 还提供 `decisionId`、可选 alignment preview。提交后失败仍可能已创建，不把 `ok: false` 当作零写入。见 [身份输出](src/cli/output/identity.rs)。 |
| 两域 `publish`、`set-relations`，以及 DR `evolve` | 按操作保留选中或建立/归档身份、`preflight`、`relationReview` 及有依据的事务结果；计划 review 与实际结果分别判断，不伪造 postverify review，source 的 before/after 和 action 按可证明事实提供。见 [DR mutation 映射](src/cli/mutation/decision/services.rs)、[IR mutation 映射](src/cli/mutation/investigation/services.rs)、[evolve 映射](src/cli/output/identity.rs)。 |
| 两域 `discard`、`rename` | 分别保留选择身份、实际影响、确认或恢复事实，以及 rename 的旧新身份、路径、影响与候选/资源归属信息。预检只表达计划。见 [DR 身份映射](src/cli/decision_identity.rs)、[IR 身份映射](src/cli/investigation_identity.rs) 和[共同事务输出](src/cli/output/transaction.rs)。 |
| 两域 `sync-index` | 区分 full / selected、preflight / 实际执行、`changedIds`、所选 ID、索引位置、状态、warning 和适用的 `coverage`；事务分支的字段可能不同于预检 DTO。见 [DR selected](src/mutations/sync/decision_selected_sync.rs)、[IR selected](src/mutations/sync/investigation_selected_sync.rs)、[IR full](src/mutations/sync/investigation_sync.rs) 和各域 mutation 映射。 |
| 两域 `stage` | 适用范围、选择、实际 `writtenPaths`、`preservedPendingPaths`、`callerOwnedPaths`；DR 另有 `indexRelativePath`、`pendingFileCount`，IR 有 `indexPath`、`namespace`、`changed`、`state`。失败可含 `pending`、未知的 `changed: null` 和恢复提示。见 [stage 输出](src/cli/output/transaction.rs)。 |
| DR `archive`、`mark-aligned`、`reactivate` | 受影响 ID、原/新状态和路径，及实际事务/预检事实。见 [lifecycle 输出](src/cli/output/transaction.rs) 和 [执行映射](src/cli/mutation/decision/lifecycle.rs)。 |

rename 两域分别提供 `oldName` / `newName`、候选和正式关系改写计数及 `affectedCountsScope: "selected-and-rewritten"`；IR 另有 `affectedResourceReferenceCount`，计量所选及实际改写来源中的资源字面引用。该范围不包含未选候选，不为计数读取或改写它们。IR 预检或失败时的计划使用 `plannedResourceOwnerMove`，实际结果使用 `resourceOwnerMoved`，不能以计划推断移动已完成。DR rename 对域内 Git pending 执行保护；冲突或无法证明时停止，不能覆盖 pending。IR discard 成功后的 `deletedResourceIds` 与历史确认需求 `requiresRecordedDeletionConfirmation` 分开表达；预检只提供 `plannedDeletedResourceIds`。

selected sync 和 stage 的多个 selector 诊断保留各自有序的 `target`、`reason`、`recovery` 及可证明的 scope、state、`causeCategory`、`operation`、`detail`；IR `reportCount` 仅在可信 baseline 已验证后提供。没有实际 I/O 错误细节时，`detail` 省略，不伪造 Node `realpath` 错误原文。

调用者应逐分支检查结果而非依赖表中所有字段同时存在。例如 `errors` 在一个预检 DTO 中存在，不意味着每个提交或 selected 分支都提供同名字段。仓库内已核实调用包含维护命令和测试，仓库外安装副本、私有脚本和 SDK 调用不可由仓库搜索穷尽。

## 只读查询与选择性身份发现

- IR 已发布索引定位的当前来源，`show` 和 content 搜索的只读身份核验均容忍文本开头的单个 BOM。返回原文、来源指纹、stale 判断和搜索位置仍基于原始内容；此宽容不改变正式 `check` 或 `sync-index` 的严格文档校验。
- selected 检查因索引缺失、无效或位置失效而回退定位身份时，仅读取合格成员头部；只有所选来源需要全文读取与校验。无关成员的损坏正文不阻断选择，但必要的头部身份和安全错误、回退中仍需定位的重复所选 ID 以及所选全文错误仍须报告。对于索引已定位的 ID，不因此增加全集扫描；selected 检查仍不证明全集。

## 文件与事务边界

本节定义[顺序本地运行模型](../../docs/decisions/261107-rust-record-candidate-sequential-local-runtime.md)的文件与事务边界，面向合作型本地单用户顺序操作；不承诺非合作进程的跨文件原子隔离。实际能力以实现及相应平台测试证据为准。

- 正式调用正常读取并准备一次，完成必要领域校验；预检仅展示计划，不保存执行凭据。保留基本工作区路径范围；已有文件用成熟库原子替换以保护旧内容；替换后普通文件属性由库和操作系统决定，不保证继承旧权限。新建使用 `create_new` 不覆盖已有目标，但初始化失败可留下部分新文件，按可证明的 `changed`、`writtenPaths`、`unknownPaths` 和写入诊断如实报告，不提供完整内容原子发布保证。
- IR 发布身份和成员是业务事实，不能从正文猜测。资源普通冲突预检后目录 rename，再顺序更新引用和必要索引；多文件过程允许部分完成。不提供普遍备份或自动回滚。失败时应对照实际结果和现场，不假定未发生写入。
- stage 合成所选记录同 JSON 内容，保留未选暂存，以 `hash-object` 和一次 `update-index --index-info` 交给 Git 自身管理锁；不使用 CLI 手持 real lock、alternate index 或 HEAD/pending CAS。写入前检查路径组件的文件/目录冲突：Git 更新可能驱逐已有的祖先或后代项，只有本批明确删除的项可被替换。这是保留未选暂存所必需的检查，不是并发保护。Git pending 不是工作区备份。

## 事务、编码和恢复

version 2 保留业务结果的信息粒度，以及适用的 `status`、`changed`、`committed`、`writtenPaths`、`unknownPaths`、`errors`；诊断按有证据的 `operation`、路径和原因区分失败步骤。`committed` 只表示适用操作的实际提交点已发生；计划身份、路径及 review 不能代替实际完成结果。`writtenPaths` 表示已知实际影响，不保证路径内容完整，也可以与 `unknownPaths` 重叠：例如新目标已创建但写入失败时，`changed: true` 是真实变化，内容仍未知。使用者应检查现场并对账。

不再产生事实的 `verification`、`outcome` 恢复状态、`recoveryBackups`、`recoveryDirectories`、`cleanupErrors` 不以恒空或 NotRun 兼容壳保留；不能虚构 `rolled-back`、通过验收或 postverify relationReview。失败、结果未知和实际完成必须分别表达。成功 trace 保留原特殊形状。

源文档和索引文本中的孤立 UTF-16 代理项被结构化拒绝，不静默替换；正常文字和完整 emoji 不受影响。预览按 UTF-16 code unit 截断时仍须保留原 JSON 输出契约，包括截断产生的转义代理项。安全和并发能力依实际平台与证据界定，不承诺非合作进程的跨文件原子隔离。
