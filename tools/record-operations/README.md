# 共同记录操作维护

本 owner 仅服务 Decision Records 与 Investigation Report，依赖方向为
`DR / IR → record-operations → index-runtime / shared`。两个 skill、CLI、公开程序化边界和持久索引格式保持独立。

## 操作入口与责任

| 入口 | 共同责任 |
| --- | --- |
| `synchronize.ts`、`selected-synchronize.ts` | 全量交接完整来源快照；DR/IR selected 以合法 canonical 发布基线定位所选已知路径与必要依赖，组合完整投影，显式声明未选来源当前性未检查。两者继续使用原生构建、fresh、发布与 readback；通用 Index Runtime selected 及其他消费者不变。 |
| `query.ts` | 严格加载正式索引，按实际依赖惰性证明完整领域图，精确计数并只收集返回窗口。无关系条件不审计全域图；关系条件与 trace 对同一投影只证明一次，raw 索引入口仍独立严格验收。 |
| `candidate.ts` | 安全发现、身份与冲突检查、动作选择、所选 readiness，以及创建的路径分配与写入。列表对单份坏候选 warning/skip，显式目标错误失败；安全、可见身份冲突和必要依赖错误仍拒绝。 |
| `check.ts` | 以首次安全采集的来源身份、字节与资源事实构建并比较完整预期索引。不在结束时重读全集，不保证结束新鲜度或跨文件原子快照。 |
| `transaction.ts` | 统一非 stage 写入的准备、fresh、实际写集、提交、写后验收与收尾/恢复顺序；普通维护、严格 rename/discard 和候选创建均由此编排。 |
| `transaction-snapshot.ts`、`transaction-journal.ts` | snapshot 安全采集 canonical 路径、父链与 FileHandle 证明；journal 拥有单事务实际写集、未知写入及 commit/cleanup 状态。`transaction-files.ts` 保留文件操作入口与重导出，主事务顺序仍在 `transaction.ts`。 |
| `transaction-verification.ts` | 拥有单次文件验收阶段的安全观察；同 root、目标与完整预期事实可在重叠保护间复用，写前与写后阶段分别实际采集。 |
| `source.ts` | 核对 canonical workspace/collection 包含边界，通过安全 FileHandle 读取正文；拒绝越界、symlink、inode/字节漂移与非法 UTF-8，以同一字节核对 ID，完整正文不套搜索预算。 |

领域提供 definition、ID/name 规则、Markdown 解析/投影、领域图、直接资源/owner、生命周期、实际写集、默认 limit/预算与 DTO/诊断映射。来源、资源及移动所需的领域 I/O 留在领域，操作顺序和准入条件由本 owner 决定。适配入口分别见 [DR 维护](../decision-records/README.md)与 [IR 维护](../investigation-report/README.md)。

[Index Runtime](../index-runtime/README.md)拥有派生索引协议及既有 stage 协调器；shared 拥有底层安全 I/O、图和版本管理不变量。共同能力限于两个现有消费者，不引入跨调用缓存、插件注册或通用事务框架。

## 同阶段证据与后续复核

同调用、同阶段的准备结果绑定 definition、来源身份、原始字节和已完成的严格证明，直接传给消费者；领域图证明与原生索引构建证明分别交接。进入 fresh 或写后验收阶段后，先前结果只作为比较依据，不能替代本阶段真实来源、成员与索引的重新验收。

严格事务可在同一 prepare 内交接强来源 snapshot：正文由该次安全采集的实际 bytes 严格 UTF-8 解码，证明同时保留文件身份、mode 与完整父链。消费时绑定真实事务命名空间的 root、path 及预期 bytes/text；不能把较窄根下的父链改锚为另一事务根的证明。具体根选择由领域适配源码承接，安全采集与绑定入口见 [`transaction-snapshot.ts`](src/transaction-snapshot.ts)。

领域在同一次 prepare 或 postverify 内，可复用本阶段已采集且正文未变的解析文档；正文改变仍重新解析，最终完整领域图与预期索引仍验收。postverify 必须先新采集本阶段的来源/layout，不能借用 prepare 文档。原生索引 fresh、事务 fresh 与 postverify 保持各自采集义务；本内部交接不扩展默认非 strict 路径、公开 SDK 或持久格式。

全量同步由领域验收完整来源、身份和领域闭合后交接 snapshot。DR/IR selected 只从 canonical baseline 的已知路径采集选中与必要依赖；未选依赖仍须符合发布 revision，未读条目沿用基线，完整组合索引与图继续验收。已知路径缺失按删除，不辨认未知位置移动；同路径改 ID 须旧、新 ID 同选并经实际来源证明。`coverage.checkedIds` 包括这些身份标签与实际依赖，不声明每个 ID 存在或未知位置发现完整。写前独立重读现存来源与实际 baseline，比较 bytes/identity/mode/父链；缺失位置在两次读取中独立证明 canonical namespace 内安全缺失，不承诺缺失实体的 inode/mode 或缺失父目录跨阶段同一性；全量只读 check 的首次采集规则不改变 sync 或事务的阶段义务。

### 文件验收阶段的重叠保护

`RecordVerificationPhase` 固定一个真实事务 root 和一次验收阶段。首次访问绝对目标时安全读取实际 snapshot；同阶段后续保护仅在完整预期事实与该实际 snapshot 等价时复用，等价覆盖 bytes、dev/ino、mode 与完整父链，不要求预期对象引用相同。不同 namespace、路径或预期事实必须重新读取并验收；内部保留实际读取的 bytes，而非调用者可变的 expected 引用。

`verifyPlan` 与 `verifyWritten` 各自创建新 phase，让重叠的 unchanged 写集与 guards 在本阶段共用一次实际观察；写前通过不替代写后读取。实际写入的 handle/readback、恢复 CAS 和领域 fresh/postverify 继续承担各自证明，本接点不把它们合并为一次验收，也不跨调用保存事实。

## 阶段内读取队列

`reader-batch.ts` 只执行领域已决定的路径与读取契约，不选择来源范围或事务阶段。少于 1000 项沿用原 async 读取；达到 1000 项时，同阶段使用一个独立 worker 串行同步读取。1000 是已观察的最小有益规模，不是最优交叉点，不提供 fast/unsafe 开关。正常 worker 沿用 Node 原生执行参数继承；父 Node permission 模型启用或实际使用 `--input-type` 时预先选择当前进程 async 读取，不启动 worker，也不失败后重试。保留父执行约束，受约束分支不承诺 worker 加速。

worker 以最多 64 路径、约 8 MiB 的软字节块交接，等待有序 consumer 消费后才继续；字节阈值只形成背压，不截断单文件，不承诺精确内存峰值。正文仍完整读取，强 snapshot 保留真实 root/path、bytes、identity、mode 与父链；同步和异步执行共享安全规则。

单文件失败按原路径顺序交给领域，保留 Error 类型及可用系统 code；启动、协议或 worker 异常是基础执行失败，不能自动退回另一读取模式重试。consumer 异常、取消及提前停止均先收束 worker，调用返回后不再产生后台读取或回调。新鲜检查、写后与恢复各取得本阶段真实事实，不跨阶段或跨调用保存读取缓存。写入、提交、权限、实际句柄证明与恢复不进入队列。

本地分发保留显式 worker 模块闭包，worker 从同一 skill 安装内的 URL 启动，不依赖主仓库路径或另一 skill。生成一致性和隔离安装的真实 Node worker 测试分别证明文件闭包与可执行性。

## 事务事实与恢复

1. **预检**：不取得独占写锁、不写持久文件、不保存执行凭据；合作锁忙不作为预检前置门槛。
2. **执行准备**：参数与集合路径等轻量入口检查后，在集合锁内完整准备一次并独立 fresh；不自动运行锁外完整预演，锁忙可以先于深层领域错误。`unchanged` 仍核对适用来源、成员和索引。
3. **写入与提交**：只记录实际完成的写入。正式事务以实际索引发布为提交点；候选创建以安全独占建立为提交点，更名以目标写集建立且旧位置退出为提交点，删除以对象退出受管集合为提交点。候选动作不为统一流程制造正式索引。
4. **写后验收**：writer 返回后，独立核对实际目标 bytes、identity、mode 及相关来源和成员；通过后才可报告适用的成功 review。
5. **收尾或恢复**：按是否已提交和实际写集处理，保留验收、清理与解锁各自的失败事实。

越过提交点不自动回滚。提交后验收失败或未知保留已知 committed/changed，报告 `partial-or-unknown` 与验收失败；验收通过且仅清理或解锁未完才是 `committed-cleanup-pending`。收尾失败非零、保留真实 mutation 和路径，多个失败分别诊断，不返回成功 review，不建议直接重试。无写入而解锁失败同样非零，但不虚构 committed。

提交前恢复只撤销实际完成的写入，并要求当前仍匹配本事务 written bytes／identity／mode；旧路径仅缺失时独占恢复，索引同样 CAS。未写成员和后来编辑／新建 winner 不被恢复覆盖。只有完整旧范围和未选保护均已证明才报告 `rolled-back`，否则保留现场人工对账；此机制不承诺非合作外部编辑的原子隔离。

### 创建权限与实际句柄证明

`RecordWritePermissions` 区分互斥的精确 `mode` 与原生 `creationMode`：精确模式用于已有来源、复制/恢复和已有索引的表示保持；原生模式只用于不存在目标的独占创建，由系统应用进程 umask，不通过 chmod 补足被限制的权限。DR 候选及首次正式索引请求 `0o666`，IR 请求 `0o600`；请求值不是最终权限保证。

原生 writer 必须交接实际写入 FileHandle 的 dev、ino 与最终 mode，capture/readback 及恢复 CAS 均核对该证明，不从写后路径猜测归属。混用两种权限意图、对已有目标使用原生创建请求均在写入前拒绝，`unchanged` 也不能绕过；无实际 handle 证明的 opaque writer 不获得恢复所有权。已有表示的精确保护不因引入原生创建而放宽。

## 分发与验证

源码闭包由各领域同步器独立复制，不依赖另一 skill 安装。改动按实际消费关系同步生成、运行原生测试并维护 Case，最终运行项目完整变更门禁；具体命令见[项目工具链](../../docs/tooling.md#工具维护命令)。
