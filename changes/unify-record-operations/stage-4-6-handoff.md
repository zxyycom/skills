# 批 4–6 实施交接

## 证据范围与阅读路径

本交接承接[批次 0–3](stage-0-3-handoff.md)，保存批次 4–6 checkpoint 的接入、命令归属、独立正确性审查与执行证据。总进度只见 [tasks](tasks.md)，批准目标见 [design](design.md)，当前实现阅读从[共同操作 owner](../../tools/record-operations/README.md)进入；性能与最终配对见[证据入口](evidence/README.md)。

三项独立正确性阻断已按下文闭合；代码规范整改及其回归、最终全量 Gate 与性能验收仍由根协调。本文件的测试、分发与 Gate 记录只证明对应 checkpoint，不自动更新任务勾选，也不证明后续优化输入已通过。

0–3 的查询、候选及 prepared 责任继续有效；stage 仍由 Index Runtime 编排，领域资源与生命周期留在各域。以下私有文件名用于恢复本阶段接入，不作为后续文件布局约束。

## 共同事务与首次检查

- `tools/record-operations/src/transaction.ts` 是唯一事务顺序 owner：prepare → 独立 fresh → 原始保护 → 实际写集 → 提交／readback → domain verify → cleanup／recovery。普通与严格领域事务均调用它，不再各自执行写后恢复编排。
- `transaction-files.ts` 提供安全 bytes／dev／ino／mode／父链证明、独占创建、表示保持的原子发布、真实完成写入日志和 CAS 恢复。writer 返回后仍实际验收。失败 writer 的未知写入不冒认所有权；其后来状态不被恢复覆盖。
- 正式事务以实际 index 发布提交；candidate-only 的资源移动先于最后来源动作，最终创建、更名／旧路径退出保留动作提交点，不制造正式 index。其他候选关系先改，所选实际 move 最后。
- 提交后失败不自动回滚，保留 known committed／changed 和实际路径，验收失败或未知与 cleanup-only 分开；各域集合锁输出保留完成结果与多个失败，不把非零误作零写入。
- 恢复仅实际写集、当前 written bytes／identity／mode CAS、旧路径缺失时独占恢复、index 同 CAS。未写成员及后来 winner 保持；完整旧范围与未选保护成立才 rolled-back。非合作外部编辑无原子隔离承诺。
- `check.ts` 共同检查两域本次首次取得的同份来源投影与完整预期 index；不结束重读来源，不宣称结束新鲜或跨文件原子快照。公开旧 `validateDecisionScan(scan)` 仍自行取得独立当前来源，不把 caller-held scan 当当前证明。
- `synchronize.ts` 仍拥有 baseline → selector → build → 独立 fresh／native publication。DR 安全初次 scan 得到的失败仅作为 `baselineFailure` 交接，raw selector 检查后直接失败，不能第二次读取成功掩盖首错。完整 sync 可显式恢复坏 index 的边界不变。

## 领域接入与退役

### Decision Records

- `decision-transaction.ts` → `decision-transaction-plan.ts`／`decision-transaction-projection.ts` → 共同事务；`decision-source-membership.ts` 拥有领域成员保护。
- 普通 publish／set-relations／无删除 evolve／mark-aligned／archive／reactivate 从发布基线准备所选来源、受影响闭合成员和必要依赖；CLI 外层解析、历史判断及锁内重新准备保留领域责任。
- 严格 rename／discard／带删除 evolve 继续完整来源、历史授权和冲突确认，实际共同写集进入同一 owner。真正 same-ID/path rename 走 `decision-rename-noop.ts`，不改 canonical 正文、index 或 mode，不要求历史更名确认。
- `decision-candidate-publication.ts` 的 new 单文件 publication 同样接入共同事务，保留创建事实／路径和失败的 readiness 边界。
- 纯候选 rename／discard 只 guard 既有 index，绝不规范化或重写；末条正式删除保留合法空 index，list 和后续 publish 可继续。
- 退役旧事务实现：`decision-maintenance-transaction.ts`、`decision-transaction-files.ts`、`decision-transaction-preflight.ts`。生成副本随 sync 退役。

### Investigation Report

- `publish.ts`、`relation-transaction-execution.ts`、`rename-publication.ts`、`discard-publication.ts`、`candidate-create-publication.ts` 只适配领域准备、实际写集、独立 fresh、领域后验与结果映射，共同顺序在 `runRecordTransaction`。
- `relation-transaction-preparation.ts` 仅加载领域上下文；无变化不再提前跳过 fresh。
- `rename-resource-move.ts` 保留领域 owner 树复制／退出／恢复：按真实成员 bytes／identity／mode 证明，记录实际删除与复制；恢复不递归删未知成员，不覆盖旧位置新建 winner。`transaction-files.ts` 保留普通集合成员身份保护。
- 删除 tombstone 位于集合父目录，正式删除提交点仍是实际 index 发布，候选删除无 index 写入。cleanup 仅删除实际证明属于本事务的 tombstone 文件与资源；未知附加成员保留现场。
- candidate rename 仍承担严格来源、资源、历史与冲突义务，但只 guard 正式 index，合法 CRLF bytes／inode／mode 保持；同-ID/path no-op 只做必要安全与身份确认。
- 退役旧事务／恢复实现：`relation-transaction-publication.ts`、`rename-recovery.ts`、`publish-preparation-start.ts`；删除无消费者 `writeNewText` 与 `ReportFileSnapshot`。

### 持久 index 安全读取的直接影响

`tools/index-runtime/src/storage-sync.ts` 的完整 sync persisted read 复用 `readBaselineSource`；单次 FileHandle 采集核对 file、canonical root、nested parents 与稳定字节。合法缺失、坏 JSON／UTF-8、I/O 与目录 EISDIR 机械分类保持；不改变 source readRevision fresh、stage／scope 或其他消费者业务语义。DR、IR、novel-cards、test-evidence-review 四个分发 consumer 都需生成与检查。

## 非 stage 全命令与直接调用盘点

以下为当前 CLI 注册集合逐项归属，不是只抽样 publish。help／参数解析独立无集合 I/O；既有 stage 三种 scope 保持原 owner。

| 入口 | DR 路径／责任 | IR 路径／责任 | 共同 owner／边界 |
| --- | --- | --- | --- |
| help、各 command --help、参数错误 | cli-program／cli-args | cli-program／cli-parser | CLI 自有，无领域读写 |
| list | decision-query-list | query-index | query.ts 严格发布投影、惰性图与窗口 |
| search metadata | decision-query-search-metadata | query-search-metadata | query.ts 精确计数／同图证明；领域字段投影 |
| search content | decision-query-search-content | query-search-content | 发布范围＋安全当前文本／同字节ID，不扩大当前全集 |
| show | decision-query-service | query-report | source.ts 完整严格UTF-8正文及身份 |
| trace | decision-query-record-queries | query-trace | query.ts 同发布投影完整图证明；领域追溯切片 |
| candidates | decision-query-candidates | candidate.ts | candidate.ts 安全发现／仅实际候选准备，领域 readiness |
| show-candidate | decision-query-record-queries | candidate.ts | 同一候选 owner，显式目标失败不降级 |
| new | decision-candidate-service／publication | candidate-create／publication | candidate identity 准备＋共同 transaction 单写；不建正式index |
| publish（含多选与preflight） | cli-maintenance-execution → decision-transaction | publish | 同一transaction；领域完整最终图／review |
| set-relations（含多source replacement/preflight） | cli-maintenance-execution → decision-transaction | relation-transaction → execution | 同一transaction；完整before/after及领域合法性 |
| evolve 无删除／有删除 | ordinary maintenance／strict lifecycle → decision-transaction | 无此生命周期 | 同一transaction，保留DR闭合／历史／删除规则 |
| mark-aligned | ordinary maintenance → decision-transaction | 无此生命周期 | 同一transaction；alignment领域所有 |
| archive | ordinary maintenance → decision-transaction | 无此生命周期 | 同一transaction；来源位置移动及index发布 |
| reactivate（含preflight） | ordinary maintenance → decision-transaction | 无此生命周期 | 同一transaction；DR显式alignment |
| rename（含preflight／真正no-op） | decision-rename／noop → decision-transaction | rename → rename-publication | 同一transaction；实际身份变化严格，no-op必要安全真零写 |
| discard 候选／正式 | strict lifecycle → decision-transaction | discard-entry → formal/candidate → discard-publication | 同一transaction；候选不写index，正式末条合法空index |
| check 全量 | index.ts → scan-index-check | validation-check-flow → investigation-state-index | check.ts 首次来源＋完整预期index，不结束重读 |
| check --id | 不提供此scope | validateScopedCollection | IR既有局部验证，未降低scope或夸全集 |
| sync-index 全量／selected／preflight | decision-query-sync | validation-sync-flow | synchronize.ts；预检不取独占锁，正式锁内完整来源及独立fresh |
| stage all/index/domain | decision-stage-service | staging.ts | Index Runtime既有record-staging，不转交本切面 |

程序化／直接调用闭包：

- DR 分发 `cli.ts` 公开 `runDecisionRecordsCli`、`renameDecisionRecord`、`scanDecisionRecords`、`validateDecisionRecords`；命令与SDK共享上述owner。内部直接 `applyDecisionChanges`、`applyLockedDecisionChanges` 均只委托 `applyPreparedDecisionTransaction`，没有第二套事务；bootstrap 也经此路径。公开 caller-held scan 校验仍独立 fresh，见前述边界。
- IR 分发 `cli.ts`／声明源 `api/check-investigations.d.mts` 的 query/show/trace/search、candidate create/list/show/publish、rename、discard、set-relations、validate/synchronize 与 stage 均映射表内同一实现。`WithWriter`／`WithHooks` 测试入口进入相同实际事务，不是另写算法；内部 candidate discard 复用 formal discard publication owner，但没有正式index写入。
- 两域 `syncDecisionIndex`／`syncInvestigationStateIndex` 是既有派生协议适配（raw sync、严格检查等直接消费者）；底层仍由 Index Runtime native sync／fresh 负责，不复制领域事务、不把生命周期交给Index Runtime。load/parse/build 等纯协议入口保持原义。
- 退役文件的导入已消失，sync 负责删除 generated closure 中旧模块；不保留旧入口别名、长期双轨、跨调用缓存或 registry/provider/事务DSL。

## 阶段验证记录

以下分别记录独立正确性闭合、原生与生成验证、独立分发；最后规范优化、最终 changed Gate 及 1W 配对不由这些结果代替。

### 独立正确性闭合的三个直接影响

1. **资源目录 journal**：mkdir 完成即保存 dev／ino／mode，之后才 chmod 并更新表示。根／子目录 chmod 失败可安全撤销实际创建；identity 无法取得或目录已被 winner 替换则保守 partial，不递归删除未知成员。回归为 `rename-recovery.test.ts` 的目录 journal／unknown 两个最小 native，Case 为 `investigation-resource-directory-{journal,unknown}-001.md`。
2. **真实 write handle ownership**：默认原位／独占创建与共同 atomic writer 返回内部实际 handle dev／ino，capture 必须匹配；不能把 close→readback 之间同 bytes／mode 的新 inode 当本事务写入。opaque custom writer 未证明的新 inode 标记 owned=false，提交前恢复保留现场，不扩大领域公开 API／DTO。两域 shared wrapper 共用同一回归，Case `record-transaction-handle-ownership-001.md`。DR atomic、IR 资源 copy 和 IR 默认关系 atomic 适配交接实际证明。
3. **IR new 写后身份**：shared verify 安全重取身份集合，比较原集合＋实际新 candidate 的 ID／locator，拒绝写后新重复；不扩大完整候选 readiness 或已发布正式 header 读取。失败保留 created／changed／ID／path，partial，CLI 不输出成功 readiness，SDK 不宣称成功 readiness。Case `investigation-new-postwrite-identity-001.md`；真缺 index 下 new 的准备／fresh／verify 与随后 show 各取一次必要 header，现有计数回归更新为四次。

独立 reviewer 用原三个区分 fixture 复跑：根目录 chmod 失败无残留且旧来源保留；close→capture 新 inode winner 保持新字节且 partial；postlink duplicate 返回失败且两个来源、创建 ID／path 保留。该审查已关闭三个阻断且在指定边界内无剩余问题；未把此结果扩张为全仓库或风格审查。

### 实际完成的验证

- `bun run typecheck`：通过。
- 四源码目录 `oxlint --type-aware --deny-warnings`：通过；TS 仅按所改作用域格式化，未格式化 fixture Markdown、JSON 或历史调查资源。
- `bun run test:index-runtime`：83 passed／0 failed（安全 persisted read 改动后；后续三修复未改 Index Runtime）。
- `bun run test:decision-records-cli`：352 passed／0 failed（含 handle ownership 最终修复与真实域适配）。
- `bun run test:investigation-report-check`：347 passed／0 failed（含三修复、候选写后身份及必要缺索引 header 读取计数）。
- `bun run test:test-evidence-cli`：35 passed／0 failed；`bun run test:novel-cards-cli`：37 passed／0 failed。
- Node 两域共同事务＋真实 domain adapter 旧稳定 checkpoint 18／18；最终三个新故障区分由独立 reviewer 在 Node 小 fixture 实际复核，不冒充又跑过旧完整 Node 集合。
- 四 consumer 的 `sync:decision-records-cli`、`sync:investigation-report-check`、`sync:novel-cards-cli`、`sync:test-evidence-cli` 及 `sync:skill-updaters` 全部完成；相应五个 `check:*` 全通过，旧生成模块经同步入口退役。
- 根协调的稳定文档优化后，以 `bun run decision-records -- sync-index --root .` 统一同步四份决策正文；`bun run decision-records -- check --root .` 通过（394 条，150 active／244 archived，0 candidate）。
- `bun run sync:test-evidence-catalog` 然后 `bun run check:test-evidence-catalog`，串行通过 1428 个最小原生入口完整覆盖；`bun run test-evidence -- check --root .` 通过。新增 Case／入口、改名／退役引用已同步，无并行 sync/check。
- `git diff --check`：通过。没有 stage、commit、push 或 Change finalize；版本维持本 Change 相对 HEAD 的既有提升（DR90／IR79／novel11／test-evidence43），未重复 bump。

本阶段未重复运行最终 `bun run check:changed`；该 Gate 须在最后代码优化及必要回归完成后针对稳定输入运行。1W 性能与配对结论由[证据入口](evidence/README.md)及专属报告承接，本阶段没有追加性能样本。

### 独立分发完成

四个 skill 均在仓库外独立临时目录复制完整包（排除 node_modules），分别执行 `pnpm install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated --offline --ignore-scripts`。四者安装成功，未下载，依赖不借用仓库 node_modules；Node v26.8.2 原生启动 `--help` 和公开函数 import 全通过。DR／IR／test-evidence 对仓库发布快照只读 list limit=1；novel-cards 在受控临时 detail／plot 卡 fixture 中 sync-index --write 后 show 成功。完整包复制发生在稳定文档优化和最终再生成之后。全部受控副本在 finally 删除，没有留下可分发安装产物。

## 阶段退出与后续验证

本 checkpoint 的实现与验证已交回根协调。后续代码规范整改、影响回归、最终 1W after/配对及 changed Gate 仍按 [tasks](tasks.md)验收；Git 保存和 Change 结项另按授权执行。阅读本文件时应保留上述已执行证据，但不能把阶段交接当作当前写入锁、最终验证窗口或整体完成状态。

## 规范优化后的合流验证

以下为后续规范整理的稳定 checkpoint；总进度仍由 `tasks.md` 承接，性能结论由 `evidence/README.md` 路由。

- 共同事务、DR 与 IR 查询切面的 20 个源码文件／202 个函数按原阈值无 finding；共同契约 10／10、DR 权威聚合 352／352 通过。IR 的 153 个源码文件／1498 个函数、235 个源码／测试文件及 150-token 重复检测均无 finding；IR 聚合 347／347 通过。最后三个跨模块计划仅补显式返回类型，随后 typecheck、type-aware lint 和格式检查通过。
- 五个恢复测试迁移保留原断言，对应 Case 的 Tests 已更新；根统一执行 `sync:test-evidence-catalog`、`check:test-evidence-catalog` 与领域 `check`，1428 个入口覆盖通过。
- 四个 skill 与 updater 的公开同步和生成检查全部通过。最新 DR／IR 完整独立副本完成 offline、frozen、isolated pnpm 安装，Node help、SDK／新模块 import 与真实 list limit=1 全部退出 0；源包 bytes／mode／symlink 指纹保持，副本已清理。novel-cards／test-evidence 的运行时导入与依赖未受本轮责任整理影响，复用既有独立安装证据及本轮生成检查。
- 独立 reviewer 在责任整理后重放原三个故障窗口：资源目录完整退出、后来 inode winner 保留、IR 新建重复身份失败且保留真实创建事实，均通过；该结果只覆盖这三个窗口。
- `bun run check:changed`：61 passed、0 failed、0 unavailable、3 release-only not-applicable，fallback 0；原生执行 98.8s，CLI 总墙钟约 102.3s。证据为 `.log/vibe-check/invocations/20261023T091528913Z-d27000b8-c1e3-48fd-b381-3bd55e4433ea/`。该轮不代替随后 1W 配对与其报告变更后的最终验收。

### 原生创建权限修复 checkpoint

后续性能尝试暴露 DR 新建权限从原生请求变为固定表示的问题，已恢复[创建权限与实际句柄边界](../../tools/record-operations/README.md#创建权限与实际句柄证明)：DR 候选/首次索引使用原生 `0o666`，IR 使用 `0o600`，不以 chmod 绕过 umask；已有来源、复制/恢复及已有索引继续精确保留 mode。写入、readback 与恢复绑定实际 handle 的 dev/ino/mode。

- 两域各有一个最小原生入口，共用独立 Node 子进程验证：umask `0002/0022/0200` 下，DR 候选与首次索引分别为 `0664/0644/0466`，IR 分别为 `0600/0600/0400`；发布保留预设 `0640` 的来源表示。独立 reviewer 已实际复核，证明范围为 POSIX mode 与 umask，ACL 未直接验证。
- 另一组两域最小入口共用实际 handle 契约：默认与 atomic 创建交接实际 mode；close 后权限漂移使 capture 失败，恢复 CAS 保留后来修改；已证明的提交前创建可撤销，opaque writer 无证明时保留现场并报告 `partial-or-unknown`。权限意图混用、已有目标误用原生创建和 unchanged 绕过均拒绝。
- 对应 Case 为[两域原生创建权限](../../docs/test-evidence/cases/record-native-creation-modes-001.md)与[实际 handle 证明](../../docs/test-evidence/cases/record-native-creation-handle-proof-001.md)。本段记录此修复及定向独立验证，不把前一 checkpoint 的 Gate 视为已覆盖本次改动，也不证明修复后的 1W 性能；生成与最终验收由根继续协调。

### 权限修复后的合流验证

- 四 consumer 与 updater 再次统一同步并通过对应五个生成检查；两条新 Case 和四个最小原生入口经统一同步、项目引用检查及领域 check 验收，共 1432 个入口覆盖。
- DR／IR 最新完整包分别在独立临时副本完成 offline、frozen、isolated 安装，真实 Node help、公共 import、list 和候选 new 均退出 0。运行依赖均来自各自副本；umask 0002 下实际新建 DR 为 0664、IR 为 0600，均未制造正式索引。源包与副本 bytes／mode／symlink 指纹前后一致，副本已清理。
- 新权限 native 已同时登记到领域聚合与语义 Gate 入口。三子 Node 集成测试使用局部 30s 预算，不改全局预算、断言或产品性能要求；Node 与 Bun 定向各 2／2，`test:check` 88／88，DR maintenance 155／155，定向 lint／格式／指标均通过。
- `bun run check:changed`：61 passed、0 failed、0 unavailable、3 release-only not-applicable，fallback 0。证据为 `.log/vibe-check/invocations/20261023T101045526Z-7dc91f84-f24b-4090-b2ad-0a87f2ef42da/`。运行期间性能分析材料新增导致 receipt 未发布；本轮是实际检查结果，不是稳定工作树最终验收。性能及报告完成后须再次运行完整变更门禁。

### 逐文件 canonical 观察优化 checkpoint

后续定位发现，同一次安全来源读取重复解析已确认的 canonical 根。最小修复仅调整共同 `source.ts`：每次读取保留一次初始根解析和目标读取前后各一次精确 realpath，后者同时证明路径前缀；不跨读取或阶段保存观察证明，不引入 cache，公开 `recordCollectionIdentity` 保持原行为。

- 根与全部父链的前后 lstat 身份、目标前后 lstat、NOFOLLOW、同一 handle 的两次 stat、字节稳定性与严格 UTF-8 验收均保留。新 Case 分别承接[逐次 canonical 观察](../../docs/test-evidence/cases/record-source-canonical-observations-001.md)和[同 inode 父链/字节漂移拒绝](../../docs/test-evidence/cases/record-source-parent-and-byte-drift-001.md)；直接读取的 prepare/fresh 命名循环不等于实际事务 fresh 集成证明。
- 20 份文件、两轮阶段的小型调用量观察中，realpath 从 280 次降为 120 次，即每次读取 7→3；其余采集调用量保持。该数据只定位并证明此处重复观察减少，不是正常计时、物理 I/O 或 1W 性能结论。
- 实施方定向执行 31 个 Bun 原生测试与 5 个 Node acquisition 测试，均通过。本 checkpoint 的独立正确性/编码审查另由根协调，未在本段宣称其完成；两 consumer 生成、Case 同步、1W 重取与最终稳定 Gate 仍分别验收，不沿用前一轮 Gate 证明本次输入已通过。

### 严格 prepare 来源证明交接 checkpoint

后续严格事务切面将同 prepare 已安全采集的源 snapshot 与解析文档直接交给计划构造，契约归[同阶段证据与后续复核](../../tools/record-operations/README.md#同阶段证据与后续复核)承接。来源正文来自同一实际 bytes 的严格 UTF-8 解码；证明绑定真实事务 root/path、预期 bytes/text 与完整父链，不能以短父链改锚另一命名空间。未变文档可复用，改变正文仍重新解析，最终完整领域图/索引继续验收。

- [DR 来源证明 Case](../../docs/test-evidence/cases/decision-strict-preparation-source-proof-001.md)承接三个最小原生入口：同 prepare 额外零 reopen 与投影等价、错误 root/正文/缺失证明拒绝、最终图与独立写前保护。该零 reopen 不覆盖初始独立索引校验，也不代替事务 fresh/postverify。
- [IR 准备事实 Case](../../docs/test-evidence/cases/investigation-strict-preparation-facts.md)承接正式 rename、候选 rename 和正式 discard 三个最小入口：首次 snapshot 及未变文档复用与原生索引 freshness 分开观察，discard 后续受保护来源仍独立读取。本切面要求默认非 strict 路径、公开 SDK 与持久格式不扩展；这些定向测试不单独证明分发边界。
- 实施方已运行 DR 92 个原生测试与 IR 28 个 Node 测试，均通过；typecheck 退出 0，局部 lint、格式、指标和重复检测通过。独立正确性/代码规范审查、统一生成及 Case/index 同步由根另行闭合；本段不声明其完成，1W 重取与最终稳定 Gate 也未由这些定向结果证明。
- 此 checkpoint 首次统一生成曾失败：DR 声明可达闭包暴露内部来源 proof 依赖，要求回归私有边界而非放宽 builder 或扩大 SDK。后续生成与边界闭合见[下一 checkpoint](#严格准备复用与声明边界闭合)。
## 严格准备复用与声明边界闭合

本 checkpoint 消除实际 1W 调查发现的同锁 prepare 重复，不删除独立 fresh。DR 复用锁内已验证 scan，IR 复用首次 layout／已解析来源；共同 `RecordTextSnapshot` 绑定本次实际事务 namespace、路径、原字节、身份、mode 与完整父链。未变来源复用同字节的已验证 document，变化正文重新解析，完整最终图、revision 与 schema 仍验收。

- DR 相关 92 个原生入口、IR 定向 Node 28 个入口通过；统一 typecheck、定向 lint／格式、现行 file/function 与 150-token 重复检测通过。
- 独立 reviewer 执行新增六个 native，并以另外的小现场验证 root/path/bytes 绑定、父链及同 inode hardlink、bytes/mode/inode 漂移、提交后 winner、caller-held scan、预检到执行漂移及 IR 资源权限保护。均通过；旧 journal 故障矩阵没有重复执行。
- DR 声明生成曾拒绝内部 proof 进入 SDK。修复后 `SourceFile` 与 `index.ts` 公开签名恢复原边界，proof Map 留在私有 strict preparation；`decision-validation.ts` 承接实际校验流程。DR 公开同步与生成检查均通过，实际全部 SDK 声明不含内部 capture/proof 或跨 owner 依赖；IR 同步与生成检查也通过。
- 私有边界迁移后，实施方补测三个 DR strict native 和 caller-held 验证；独立 reviewer 另以首次 EACCES 小例确认首错不被重读掩盖、失败来源不产生 proof、下一次调用使用新的 Map、默认只读结果没有 capture。代码规范优化代理已确认声明阻断关闭、私有 owner 有实际责任且没有类型绕过。
- 两域默认 source／scan／sync／check／候选路径保持原分支。性能 owner 将按真实闭包复用有效样本，只补受影响的严格事务、必要 content／CLI 与分离计数；本段不预告耗时或整体性能验收。

## 单验收阶段事实复用 checkpoint

共同 `RecordVerificationPhase` 收口同一次文件验收中的重叠保护，原则见[文件验收阶段的重叠保护](../../tools/record-operations/README.md#文件验收阶段的重叠保护)。`verifyPlan` 与 `verifyWritten` 分别真实采集；同阶段仅 root、绝对目标与完整预期 snapshot 等价时复用实际观察，保留实际 bytes，不借用调用者可变 expected。写入 readback、恢复 CAS 与领域各阶段义务保持独立。

- [共同文件验收 Case](../../docs/test-evidence/cases/record-transaction-phase-verification-001.md)保留三个最小原生入口：unchanged 与重叠 guards 在写前/写后各读一次，不同 root/mode/inode/bytes/父链及可变 expected 拒绝，索引 writer 后来的 bytes/mode/inode 变化由写后保护拒绝并保留提交与 winner。
- IR rename 的 `verifyCommittedRename` 新建本次 postverify 的 `InvestigationPreparation`，采集完整 layout 后在本阶段共用来源、文档与 state；不读取旧 prepare 的来源证明。原生索引 freshness、完整领域图与资源验收保留。[IR Case](../../docs/test-evidence/cases/investigation-strict-preparation-facts.md)现含五个最小入口，新增观察分别证明同 postverify 两消费者获得同一解析结果，以及后来正文变化仍报索引陈旧。
- 实施方在本轮实际执行 common/DR 共同事务 Node 14/14；IR 新五个原生入口及 rename/shared 相关入口合计 25/25。统一 typecheck 退出 0，局部 lint、格式、指标及对应重复检测通过。这些是定向 checkpoint 证据，不替代随后统一生成、Case/index 检查、1W 冻结/配对与最终稳定 Gate；本段不预告性能收益。

### 本轮合流复核

- 独立正确性代理执行本轮新增的三个共同契约入口与两个 IR 入口，5 passed、0 failed，未发现实质阻断；未重复完整领域测试或故障矩阵。
- 编码规范优化代理审阅本轮实际差异，确认 phase 观察与本域 postverify 各有明确生命周期，没有新增 SDK proof、通用交接协议或多余框架；零代码修改。ai-ready-docs 优化共同 README、两条 Case 与本交接，保留全部 Tests ID 和 G1–G5。
- 根实际运行两域各自 `sync:*` 与生成 `check:*`，均退出 0，并统一同步 Case 索引。本轮没有新增依赖或再次提升版本。这些是本轮代码/生成 checkpoint；已结束的 1W 采样、较慢操作及保证成本统一从[性能证据入口](evidence/README.md)恢复，不由阶段测试或旧快照 RSS 推断全面性能通过。最终稳定 Gate 尚未执行，须由最终输入另行证明。
