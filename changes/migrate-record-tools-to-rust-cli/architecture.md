# Rust CLI 候选架构与开发入口

本文是本 Change 的实施设计，不改变当前 TS 生产入口或领域规则。范围和验收见 [proposal](proposal.md)、[design](design.md)；命令选项和逐结果映射以 0.1 盘点为准，平台保证以 0.2 冻结及实测为准。本文是 0.3/0.5 的工程方案，不是实现、平台支持或测试通过证明。

## 归属和依赖

候选放在 `tools/record-cli/`：一个独立 Cargo package、一个内部 library 和 `decision-records`、`investigation-report` 两个 bin。Rust 原生实现，不启动 Node 代理命令；不会依赖 `skills/`、`scripts/` 或另一领域的运行时。共同模块只承接两域已经共同承担的记录操作、索引与文件/Git 安全责任；领域解析、ID、关系、生命周期、资源及输出适配各自独立。library 是两个 bin 的内部组合边界，不承诺公开 Rust SDK 或插件接口。

```text
tools/record-cli/
  Cargo.toml  Cargo.lock  rust-toolchain.toml
  src/lib.rs  src/bin/{decision-records,investigation-report}.rs
  src/{protocol,index,source,transaction,stage,git}.rs
  src/domains/{decision,investigation}.rs  # 身份、正文与领域模型
  src/queries/  # 两域查询实现，独占写入
  src/mutations/  # 两域写操作实现，独占写入
  tests/  # 私有 fixture、跨进程 CLI 与 Git 边界
```

这些是责任与初始协作边界，不要求机械保留单文件；确有独立责任可在 owner 内拆分。`protocol` 负责受限 CLI 输出及错误映射；`source` 管路径、文件身份、句柄与严格 UTF-8；`index` 管 v4 envelope、revision、规范化、查找与单阶段 reader；`transaction` 管真实写集、fresh、受条件写入、readback 和恢复；`stage` 协调 H/W/P 及 Git pending；`git` 只封装必要的 Git 调用和 pending 快照。各域实现只向共享层提供必要的事实与领域校验，不引入通用 batch 或动态插件。

## Schema 和结果

跨语言索引结构的真源仍是 `tools/index-runtime/src/schemas.ts` 与两域 `src/index/*-index-definition.ts` 的 Valibot 定义；目前仓库还维护各域 `*-index-json-schema.ts` 并同步分发 Schema。Rust 不把包内生成副本反向作为真源，也不把 Rust 类型声明作为规则真源。Rust 使用强类型和显式运行时验证实现同一契约，并用现有源码生成的 schema、有效/无效 fixture 与领域校验做一致性测试；JSON Schema 不覆盖的语义（字段物化、ID 集合、关系和 fingerprint）另测。任何跨语言 schema 漂移必须先修改原 owner 并经公开同步入口更新，候选本身不触发生产同步。不得声称 JSON Schema 单独证明所有 Valibot/领域语义。

两域 `trace --json` 成功结果直接使用各自现行结构，包括缺省/省略和顺序，不套统一 envelope。其他命令候选协议为单个 JSON 对象，顶层 `version: 1`、`command`、`ok`；成功提供具名 `result` 和 `diagnostics`，失败提供具名 `error`（稳定 `code`、`message`、必要路径/字段和恢复事实）及 `diagnostics`；按 0.1 清单为每个 result 定义领域字段，不能仅放人类文本。只有可用时才输出适用的 coverage、mutation、pending、recovery；不通过空对象伪造证明。机器模式 stdout 仅一个结果，诊断结构写入对象；stderr 保留非协议诊断，参数错误退出 2，领域或系统失败退出 1，成功退出 0。trace 成功例外仍按原域通道处理。每个 `result` 的领域字段和数组顺序以 [0.1 映射](capability-mapping.md#程序化结果到-json-的映射)及其所列源码结果为冻结基线；IR 成功 trace 包含运行时 `warnings` 并同时将 warning 写 stderr，DR 成功 trace 不包含该字段且保留自身 `source`。未完成实现与差分测试前不宣称兼容。

### 非 trace JSON 分支

非 trace 机器结果严格为 `{ "version": 1, "command": "<命令>", "ok": true, "result": { ... }, "diagnostics": [...] }`；失败为 `{ "version": 1, "command": "<命令或空字符串>", "ok": false, "error": { "code": "...", "message": "..." }, "diagnostics": [...], "result": { ... }? }`。`diagnostics` 始终存在，可为空；每个诊断保留映射要求的具体字段。`result` 在失败时仅当已得到部分或未知写入、pending、恢复、coverage 等可证明事实时出现，绝不能从计划推断其成功；`error` 可附明确的 `path`、`field` 与 `recovery`，未知则省略。每域结果里的可选字段仅在来源分支实际存在时输出；来源显式 null（如 IR search column 或 stage changed 未知）保留 null，不以 null 代替缺失。无关命令不加空字段。`version` 是候选 envelope 版本而非 trace 的版本或索引 schemaVersion；结果内字段按映射逐项固定，新增破坏性修改需版本调整并审查。参数解析失败若已请求 JSON 也输出失败对象；无法判定具体命令时 command 为 `""`。成功 trace 原样例外；失败 trace 输出此失败对象，保留原领域状态和诊断，不宣称其格式是旧版兼容保证。机器错误只发送一个 JSON 对象到 stdout，stderr 可以发警告或可行动诊断但不得替代对象。

## 阶段接口与安全边界

以下为内部协作签名的形状，具体领域类型由各域 owner 定义；错误不得压成空结果。不可克隆的阶段证明不允许调用方伪造或跨阶段沿用：

```rust
// source
struct SourceSnapshot { /* canonical root/path, opened identity, bytes, mode, parent chain */ }
fn capture_source(root: &Path, relative: &Path) -> Result<SourceSnapshot, SourceError>;
// index
struct IndexReader<S> { /* validated immutable index, materialized fields, lazy graph */ }
fn open_index<S>(source: SourceSnapshot, definition: &Definition<S>) -> Result<IndexReader<S>, IndexError>;
// transaction: private constructors, exact members; per-operation domain validation remains outside
struct Prepared { /* source/index expectations, writes, guards */ }
struct Fresh { /* independently recaptured expectations */ }
fn prepare(/* selected source facts, domain proposed writes */) -> Result<Prepared, TxError>;
fn fresh(prepared: &Prepared) -> Result<Fresh, TxError>;
fn commit(prepared: Prepared, fresh: Fresh) -> Result<CommitOutcome, TxError>;
fn postverify(outcome: &CommitOutcome) -> Result<VerifiedOutcome, TxError>;
// stage: captures full pending membership; stages only selected exact paths
fn stage(/* scope, selected IDs, domain projection */) -> Result<StageOutcome, StageError>;
```

实现应使 `Fresh` 绑定唯一 prepared、真实根、目标和预期，不因类型存在就假定时间上仍新鲜；锁内对实际打开对象和 pending 做最终 CAS。`commit` 记录每项实际/未知写入及提交点，失败返回同样真实事实；postverify 从磁盘和适用 pending 独立采集，不能消费准备或 fresh 的旧字节作为结果证明。预检仅准备，不写入且不持独占写锁；正式执行重新准备并独立 fresh。提交前仅当实际当前值仍匹配本事务写入时恢复；提交后不自动回滚；清理/解锁失败仍保留变化事实。操作不声称对非合作编辑提供跨文件原子隔离。锁、路径、链接、句柄、mode、identity、缺失与目标独占创建的可证明语义随平台冻结实现，不以路径字符串比较代替打开后的身份检查。

每次命令内，一个阶段最多建立一份适用的来源/索引快照；索引字段和惰性图仅在同阶段同事实复用。准备、fresh、postverify、恢复及 stage 的准备/复核各有独立可变事实；固定 HEAD 内容可按 Index Runtime 规则跨阶段复用。局部操作只读取选集和必要依赖，未选来源沿合法基线处理，不宣称全集新鲜。stage 必须保护完整 pending 身份、保留未选路径和表示，选集、资源和 H/W/P 合成遵循各域 CLI 与 [Index Runtime](../../tools/index-runtime/README.md)，不得直接 `git add` 全域代替。

## 实现者协作接口（内部，不是 SDK）

本节固定责任、参数及状态语义；struct 字段可补充诊断，不得删去本节证明信息。读取结果未经运行时校验不能构造 `ValidatedIndex`、领域 ID 或领域记录；类型和 `serde` 反序列化本身不替代约束检查。目录 ownership 以文末分工为准；变更接口先通知所有消费方。

### 模型、文档和快照

```rust
// domains: 每域分别定义，不跨域 import；字段以对应 definition 和契约为准
struct DecisionId(/* private validated string */); struct InvestigationId(/* private */);
struct DecisionState { name: String, source_path: String, title: String,
    status: DecisionStatus, alignment: DecisionAlignment, created_at: String,
    purpose: String, background: String, decision: String,
    tags: Vec<String>, relations: Vec<DecisionRelation> }
struct InvestigationState { formed_at: String, name: String, question: String,
    relations: Vec<InvestigationRelation>, resource_ids: Vec<String>,
    source_path: String, tags: Vec<String>, title: String }
struct ParsedDocument<S> { state: S, source: String, spans: DocumentSpans,
    diagnostics: Vec<Diagnostic> }
fn parse_decision(id: &DecisionId, text: &str) -> Result<ParsedDocument<DecisionState>, DomainError>;
fn parse_investigation(id: &InvestigationId, text: &str) -> Result<ParsedDocument<InvestigationState>, DomainError>;
// 明确只更改领域操作拥有的片段；未修改部分原字节/行结束符按现行行为保留。
fn render_decision(doc: &ParsedDocument<DecisionState>, edit: DecisionEdit) -> Result<Vec<u8>, DomainError>;
fn render_investigation(doc: &ParsedDocument<InvestigationState>, edit: InvestigationEdit) -> Result<Vec<u8>, DomainError>;

// index: S 为对应领域 state；构造入口检查所有外部值和 collection invariant。
struct Revision { metadata: String, entries: BTreeMap<String, String> }
struct IndexV4<S> { schema_version: u32, namespace: String, definition_version: u32,
    metadata: serde_json::Value, source_revision: Revision, entries: BTreeMap<String, S> }
struct ValidatedIndex<S>(/* private IndexV4<S> */);
fn parse_index<S: DomainDefinition>(bytes: &[u8], domain: &S) -> Result<ValidatedIndex<S::State>, IndexError>;
fn build_index<S: DomainDefinition>(domain: &S, revision: Revision,
    entries: BTreeMap<String, S::State>) -> Result<ValidatedIndex<S::State>, IndexError>;
fn serialize_index<S: DomainDefinition>(domain: &S, index: &ValidatedIndex<S::State>) -> Result<Vec<u8>, IndexError>;
struct QuerySnapshot<S> { /* validated immutable projection, once-materialized fields, lazy graph */ }
impl<S: DomainDefinition> QuerySnapshot<S> {
    fn open(index: ValidatedIndex<S::State>, domain: S) -> Result<Self, IndexError>;
    fn get(&self, id: &str) -> Option<&S::State>;
    fn all(&self) -> impl Iterator<Item = (&str, &S::State)>;
    fn graph(&self) -> Result<&RelationGraph, DomainError>; // lazy once per snapshot
}
```

候选与正式记录不能共用强制完整字段的单一 `State`：两域各提供 `CandidateDocument`（原文、候选元数据、scaffold/body/resource readiness 和诊断）、`EstablishedDocument`（含完整 State）及 `parse_candidate` / `parse_established`；`render_candidate_scaffold(NewCandidateInput, CapturedClock) -> Result<Vec<u8>, DomainError>` 不要求既有文档。缺失的候选字段保持缺失，不伪装成正式值。`CapturedClock` 一次操作只捕获一次，正式重准备和 fresh 对同一意图复用该时间值。安全来源还提供 `enumerate_directory(root, path) -> Result<DirectorySnapshot, SourceError>` 与 `capture_tree(root, owner) -> Result<TreeSnapshot, SourceError>`，每项及空目录绑定身份、成员与父链；Git visibility 则由 git 模块分别提供 HEAD、pending 与历史事实。

`DomainDefinition` 是封闭的两域内部静态适配，提供 namespace、definitionVersion（目前两域各为 11）、metadata/state/ID 校验、查询字段提取、集合和图校验；不是开放插件。`parse_index` 严格 UTF-8、schemaVersion 4、namespace/definition identity、ID/fingerprint、entry/revision 相同键集合、所有字段及集合校验；`build_index` 同样校验。外部 `metadata` 保留为 JSON 值仅用于边界检查，当前两域都要求空对象。序列化字段顺序、JSON 转义、末尾换行和键顺序按现行 serializer 与 fixture 精确验证，不能使用 Rust `BTreeMap` 的 UTF-8 顺序冒充 JS UTF-16 顺序。query 处理者可将候选 DTO 与范围筛选放自身目录，但统一消费本 snapshot 与领域类型；图构建失败不得变成空图。`RelationGraph` 提供 `nodes() -> impl Iterator<Item=&str>`、`outgoing(id) -> &[RelationEdge]`、`incoming(id) -> &[RelationEdge]`；`RelationEdge { source: String, target: String, relation_type: String, summary: Option<String> }`，边与节点按各域现行 JS 排序规则确定性排列，构图时执行完整领域图校验；无效图返回错误。`resolve_selector` 对完整 ID 精确匹配、name 仅唯一时成功，缺失与歧义分别报错。`DirectorySnapshot` 返回每个名字、类型和绑定身份；候选枚举中单份可分类坏候选以带 path 的 diagnostic 跳过，不安全成员和重复 ID 按领域规则失败。`CandidateDocument` 带原文、readiness、diagnostics 和可选投影。

查询接口具体为 `queries::decision::run(root: &Root, args: DecisionQueryCommand) -> Result<DecisionQueryResult, CommandError>`，IR 使用等价的 `InvestigationQueryCommand`、`InvestigationQueryResult`。各 `*QueryCommand`、Options 与结果 DTO 均由 `queries/` 独占定义，core 拥有 `CommandError` 与 `Root`；各 `*QueryCommand` 是封闭 enum，变体为 `Candidates`、`Check`、`List(ListOptions)`、`Search(SearchOptions)`、`Show(Selector)`、`ShowCandidate(Selector)`、`Trace(TraceOptions)`；每域的 Options 强类型保留能力映射的全部默认值、限制、过滤、预算与 selector，IR `Check` 额外携带可重复 ID。结果是以变体区分的领域 DTO，完整字段由能力映射逐项给出；`CommandError` 至少含类别/代码、可行动消息、诊断及可选 partial result，不把警告当错误。CLI enum 可分为 `Query` 和 `Mutation` 两支，解析后借用 root 并移动已验证的参数，统一输出层按变体序列化。

DR 当前使用 `yaml` 解析 YAML frontmatter 且检查固定键与顺序；IR 当前有专用行级 frontmatter parser，检查固定顺序和正文区段，不能假定两域可由同一 YAML 反序列化规则替代。Rust 用 `yaml-rust2` 对 DR 做真实 YAML 解析，再实现 owner 的字段、顺序、类型和合法性校验；IR 按其领域格式实现独立 parser。与现行 YAML 在重复键、别名、标量解析和错误行为是否一致须用正反 fixture 差分验证，不以依赖存在证明等价。解析保留原文、片段偏移和行结束信息；编辑只在现行操作允许处重写，不能为方便将整个正文重新序列化。新建文档按各域 renderer 规范生成，更新后重新完整解析验证。

### 受信来源、事务和 stage

```rust
struct RelativePath(/* validated normalized relative path */);
struct FileIdentity { /* platform identity, kind, size, mode and parent identities */ }
struct SourceSnapshot { path: RelativePath, identity: FileIdentity, bytes: Vec<u8> }
enum ExpectedFile { Missing, Present(SourceSnapshot) }
struct Root(/* canonical root and retained identity */);
fn open_root(path: &Path) -> Result<Root, SourceError>;
fn capture(root: &Root, path: &RelativePath) -> Result<ExpectedFile, SourceError>;
fn strict_text(snapshot: &SourceSnapshot) -> Result<&str, SourceError>;

struct WriteIntent { path: RelativePath, before: ExpectedFile, after: Option<Vec<u8>>, mode: Option<FileMode> }
struct Guard { path: RelativePath, before: ExpectedFile }
enum CommitPoint { NoCommit, Created(RelativePath), Exited(RelativePath),
    Renamed { old: RelativePath, new: RelativePath }, PublishedIndex(RelativePath) }
struct Plan<T> { value: T, writes: Vec<WriteIntent>, guards: Vec<Guard>,
    resources: Vec<ResourceIntent>, commit_point: CommitPoint }
struct TransactionOutcome<T> { value: Option<T>, status: TxStatus, preflight: bool,
    changed: bool, committed: bool, verification: VerificationStatus,
    outcome: RecoveryStatus, written_paths: Vec<RelativePath>,
    errors: Vec<Diagnostic>, cleanup_errors: Vec<Diagnostic> }
fn run_transaction<T, O: TransactionOperation<T>>(
    root: &Root, operation: &mut O, preflight: bool) -> TransactionOutcome<T>;
trait TransactionOperation<T> {
    fn prepare(&mut self, root: &Root) -> Result<Plan<T>, TxError>;
    fn fresh(&mut self, root: &Root, plan: &Plan<T>) -> Result<(), TxError>;
    fn verify(&mut self, root: &Root, plan: &Plan<T>) -> Result<(), TxError>;
    fn verify_recovered(&mut self, root: &Root, plan: &Plan<T>) -> Result<(), TxError>;
    fn apply_resources(&mut self, root: &Root, plan: &Plan<T>, journal: &mut Journal) -> Result<(), TxError>;
    fn recover_resources(&mut self, root: &Root, plan: &Plan<T>, journal: &mut Journal) -> Result<(), TxError>;
    fn cleanup_resources(&mut self, root: &Root, plan: &Plan<T>, journal: &mut Journal) -> Result<(), TxError>;
}
```

`CommitPoint::NoCommit` 仅用于经过 fresh 验证的真实 unchanged，不声称提交；资源具体动作须以 `ResourceIntent` 显式有序列出创建、复制、校验、删除及墓碑动作，journal 在每一步实际完成或结果未知时记账；恢复倒序且仅在当前事实仍匹配本事务产物时执行。资源 apply 位于普通正文写入与索引提交之间；候选无索引场景资源动作先于最终 source 动作，最终动作才越过声明的提交点，具体顺序由领域计划表达。

`run_transaction` 的 preflight 无锁、零持久写，只 prepare；实际执行取得集合锁后重新 prepare、独立 fresh、锁内以打开对象校验计划和 guard（含 unchanged）、按意图执行；`CommitPoint` 依据操作声明，不推断所有操作以索引发布为提交点。重命名的提交点要求新写集建立且旧位置退出；实现必须同时记每次实际和未知写入，并在资源树生命周期中向 journal 报告同等粒度。postverify 重新打开实际目标，提交前恢复必须比较当前对象与事务写入并验证恢复；cleanup 和 unlock 失败不遮盖原结果。语义签名不足以保障内核级原子 CAS，平台代码和失败测试必须证明可实现边界，否则返回可行动的错误。

`ResourceIntent` 明确资源 owner、旧/新目录、精确成员的期望身份与移动/删除意图；`Journal` 每个资源实际/未知动作均记录，目录枚举、树成员与目标缺失同样由 fresh 核验。`ExpectedFile` 绑定 root 到文件完整父链；路径须为经过验证的相对路径。`DomainDefinition` 增加 `resolve_selector(index, selector) -> Result<Id, DomainError>`、`validate_graph(index) -> Result<RelationGraph, DomainError>`；IR 对资源由领域适配提供 `owner_members(id) -> Result<Vec<RelativePath>, DomainError>`。已解析的 `Selector` 与完整 `DecisionId`/`InvestigationId` 不混同；关系 replacement 分组用 `RelationGroup { source: Selector, replacement: Clear | Relations(Vec<Relation>) }`，在各域命令类型中保存重复输入顺序，解析时验证唯一性和排他性。历史确认、preflight、scope 和多 selector 均为类型字段，而非重新解析命令字符串。

`stage` 不套普通正文事务：`StageRequest { scope: Index|All|Domain, ids, ... }` 和领域提供的选择/投影传给 `run_stage(root, request, adapter) -> StageOutcome`；`PendingSnapshot { entries: Vec<PendingEntry> }` 的每项包含规范路径、Git mode、OID、stage number；仅所选 blob 用 `SelectedBlob { path, mode, oid, bytes }` 读取。`StageAdapter` 分别提供 `prepare(head, pending, worktree)` 与 `fresh(head, pending, worktree)` 的所选定位、索引、工作区字节和资源树，接受完整 pending 快照及域类型选择，返回所选 projected entries；发布接口按捕获的 HEAD 和 pending 成员身份条件替换，不更改目标外项。适配器按阶段提供 H/W/P 所选定位、索引、工作区字节和资源树，结果包含 pending 变化、保留路径、验证、错误及恢复事实。所有 scope 保护完整 pending 路径/mode/OID 身份但不读取未选 blob；index/all 基于 P 合成所选索引投影，domain 保留 pending 索引原字节或缺失。all/domain 用合法 H/W/P 索引和 canonical locator 定位旧路径；IR owner 树取三者路径并集，遵循 `core.fileMode`。fresh 独立取得 HEAD/P/工作区事实并有条件发布，postverify 独立回读；unchanged 也需要 fresh。

### 命令分发

各 bin 只解析自身参数并调用 `queries::decision::run` / `queries::investigation::run` 或相应 `mutations` 函数；参数由各域 `Command` 封闭 enum 承载，严格检查重复单值、必需值、互斥选项和默认值。公共入口统一处理 `Result<CommandResult, CommandError>`、stdout/stderr 和退出码；`CommandResult` 使用带命令判别的各域 DTO，不将不同命令压成文本或无约束 JSON。各命令 enum 的完整字段来自 0.1 映射，变更须双方同步；trace 成功仍以原格式序列化。

## 工具链、构建和验证隔离

候选固定 Rust/Cargo `1.98.1`，edition 2024；package 自有 `Cargo.lock` 提交以冻结传递依赖。依赖按职责使用 `serde` 1、`serde_json` 1、`sha2` 0.10、`unicode-normalization` 0.1、`unicode-segmentation` 1、`yaml-rust2` 0.10（DR YAML 解析）、`time` 0.3（RFC3339 parsing/formatting）；平台文件能力按实际需要使用 `libc` 0.2、`windows-sys` 0.61、`cap-std`/`cap-fs-ext` 4.0（Windows handle-relative capability）；测试可用 `tempfile` 3。实现时锁定解析出的精确版本及 checksum，并证明冻结构建；不引入不必要的框架。是否需要补充依赖由实际语义证明和锁文件审查决定，不以列表代替跨平台验证。

独立入口：`cargo fmt --manifest-path tools/record-cli/Cargo.toml --check`、`cargo clippy --manifest-path tools/record-cli/Cargo.toml --all-targets --locked -- -D warnings`、`cargo test --manifest-path tools/record-cli/Cargo.toml --locked`、`cargo build --manifest-path tools/record-cli/Cargo.toml --release --locked`。CI 在冻结的 Windows 原生与 Linux 目标分别执行并留存真实结果。Cargo 下载缓存与 `target/` 为本地可再生产物，不入 Git；离线制品在隔离输出中验证版本、target、hash 和回退，不作为生产发布。普通 `bun run check` 不依赖 Rust；不更改现有 sync、pack、updater、安装及生产 CLI，单独定义 Rust 代码/测试 scope 并由对应 Gate/CI 接入。项目公共 quick 及受影响代码范围仍按 AGENTS 执行。Cargo 原生测试采集、Case、性能及平台矩阵由 0.4 和实际实现完成，不能以本设计声称通过。

## 分工和未决证明

核心实现者独占 `Cargo.toml`、`Cargo.lock`、`rust-toolchain.toml`、`src/lib.rs`、`src/bin/`、`src/domains/` 和共同模块；查询实现者独占 `src/queries/`；mutation 实现者独占 `src/mutations/`。跨目录修改须先协调，模块声明由核心 owner 管理。共同层先提供最小可编译接口和类型；领域查询按各自规则实现读取、过滤、排序、图与结果，领域 mutation 按各自行为建提案并使用共同事务，stage 和 Git 的安全协调单独验收。CLI 盘点 owner 冻结每条命令和字段映射，测试 owner 以独立预期与真实私有 Git fixture 验证；工程实现不得把计划签名当成已存在能力。特别风险为平台文件身份与无跟随打开、Windows 原生行为、非合作竞争、JS UTF-16 排序/预览和 NFKC 大小写差异、各域 trace 精确结构，以及现有 TS schema 和 JSON Schema 的语义漂移。逐项依靠契约与实测关闭；若无法实现既定可观察保证，报告具体缺口而非静默降级。
