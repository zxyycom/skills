# 共同记录操作维护

本 owner 为 Decision Records（DR）与 Investigation Report（IR）维护共同操作编排、同阶段证明交接和失败边界。依赖方向为 `DR / IR → record-operations → index-runtime / shared`；两个领域保留各自的 skill、CLI、公开程序化边界、持久格式和独立分发。

## 操作入口与责任

按维护对象选择入口：

| 维护对象 | 入口与共同责任 |
| --- | --- |
| 全量与局部同步 | `synchronize.ts`、`selected-synchronize.ts`：接收领域来源事实，组合完整投影，执行原生构建、fresh、发布与 readback。 |
| 正式查询 | `query.ts`：严格加载索引，按实际依赖惰性证明完整领域图，精确计数，只收集返回窗口。关系条件与 trace 对同一投影只证明一次；raw 索引入口独立严格验收。 |
| 候选 | `candidate.ts`：安全发现、身份与冲突检查、动作选择、所选 readiness，以及创建的路径分配与写入。单份坏候选在列表中 warning/skip，显式目标错误失败；安全、可见身份冲突和必要依赖错误始终拒绝。 |
| 全量只读检查 | `check.ts`：用首次安全采集的来源身份、字节和资源事实构建并比较完整预期索引；不在结束时重读全集，不保证结束新鲜度或跨文件原子快照。 |
| 事务计划与执行 | `transaction-plan.ts` 验证并归一化提案；`transaction.ts` 编排非 stage 写入的准备、fresh、提交、验收与收尾/恢复。 |
| 事务事实与文件验收 | `transaction-snapshot.ts` 采集 snapshot；`transaction-journal.ts` 记录实际写集、未知写入及 commit/cleanup；`transaction-verification.ts` 管理阶段观察。文件操作与重导出在 `transaction-files.ts`。 |
| 完整正文读取 | `source.ts`：核对 canonical workspace/collection 包含边界，经安全 FileHandle 读取正文；拒绝越界、symlink、inode/字节漂移和非法 UTF-8，以同一字节核对 ID。正文不套搜索预算。 |
| 批量读取 | `reader-batch.ts` 及 reader 模块：执行指定读取契约并交接结果。 |

领域提供 definition、ID/name、Markdown 解析与投影、图、资源/owner、生命周期、实际写集、默认 limit/预算及 DTO/诊断映射，并保留来源、资源和移动所需的领域 I/O。共同操作决定顺序与准入条件。适配入口见 [DR 维护](../decision-records/README.md)与 [IR 维护](../investigation-report/README.md)。

[Index Runtime](../index-runtime/README.md)拥有派生索引协议和 stage 协调器；shared 拥有底层安全 I/O、图和版本管理不变量。共同操作仅服务上述两个消费者，不引入跨调用缓存、插件注册或通用事务框架。

## 同阶段证据与后续复核

### 准备结果的交接

同调用、同阶段的准备结果绑定 definition、来源身份、原始字节和已完成的严格证明，直接交给消费者。领域图证明与原生索引构建证明分别交接。

严格事务的强来源 snapshot 同时保存 canonical 路径、文件身份、mode、完整父链和该次安全采集的实际 bytes；正文由这些 bytes 严格 UTF-8 解码。消费时绑定真实事务命名空间的 root、path 及预期 bytes/text，不能将较窄根下的父链改锚为另一事务根的证明。根选择由领域适配源码承接，采集与绑定入口见 [`transaction-snapshot.ts`](src/transaction-snapshot.ts)。

领域可在同一次 prepare 或 postverify 内复用本阶段已采集且正文未变的解析文档；正文改变则重新解析，最终完整领域图与预期索引仍须验收。进入 fresh 或写后验收阶段时，旧结果仅作比较依据，本阶段重新取得真实来源、成员、layout 与索引事实。原生索引 fresh、事务 fresh 和 postverify 各自履行采集义务；内部证明不扩展默认非 strict 路径、公开 SDK 或持久格式。

### 同步的来源范围

| 模式 | 领域交接与验收范围 |
| --- | --- |
| 全量同步 | 领域验收完整来源、身份及领域闭合后交接 snapshot。 |
| DR/IR selected | 以合法 canonical 发布基线定位所选已知路径及必要依赖；未选依赖须符合发布 revision，未读条目沿用基线。完整组合索引与图仍验收，未选来源当前性未检查。 |
| 通用 Index Runtime selected | 保持其完整来源验证契约，见 [Revision、sync 与 selected scope](../index-runtime/README.md#revisionsync-与-selected-scope)。 |

DR/IR selected 的已知路径缺失按删除处理，不辨认未知位置移动；同路径改 ID 须旧、新 ID 同选并经实际来源证明。`coverage.checkedIds` 包括所选身份标签与实际依赖，不保证每个 ID 存在或未知位置发现完整。

同步写前独立重读现存来源和实际 baseline，比较 bytes、identity、mode 与父链。缺失位置在两次读取中分别证明 canonical namespace 内安全缺失；不承诺缺失实体的 inode/mode 或缺失父目录跨阶段同一性。全量只读 check 使用首次采集的规则，不替代同步或事务的独立 fresh。

### 文件验收阶段的重叠保护

`RecordVerificationPhase` 固定一个真实事务 root 和一次验收阶段。首次访问绝对目标时安全读取实际 snapshot；后续保护只在 root、目标和完整预期事实均匹配时复用。等价比较覆盖 bytes、dev/ino、mode 与完整父链，不要求预期对象引用相同；不同 namespace、路径或预期事实重新读取并验收。内部保存实际 bytes，隔离调用者可变的 expected 引用。

1. **写前**：在 `fresh` 回调开始时建立 phase，再由 `verifyPlan` 消费。
2. **写后**：`verifyWritten` 独立建立另一 phase，以实际 written snapshot 确定预期，不从 plan.next 猜测身份或最终 mode。
3. **有序验收**：各 phase 将 writes、index 和适用 guards 组成同一队列，批量选择不依赖计划表示。每个提案（包括 unchanged）在跳过前验证重复路径与权限；结构、权限错误先于文件验收拒绝。计划归一化不合并冲突或 alias 的预期事实，unchanged 判据与 journal 一致。

领域 fresh 可经 phase 的安全 text-snapshot 入口取得本阶段来源，再完成解析、图和资源证明。该入口实际读取并严格 UTF-8 解码，绑定同一 root/path，向领域交接 bytes、parents 数组及父身份对象的独立副本。成功观察可供随后完整 expected facts 比较；缺失、读取或解码失败不形成成功证明。另一入口按原路径顺序汇集单文件 mismatch/read failure，基础 worker 失败仍中止。

领域阶段适配如下；各阶段独立读取，写前通过不替代写后读取：

- IR rename 在 beforePublish 后通过本 phase 验来源与索引，保留有序错误聚合、target/owner absence、membership 和 no-op 身份重备。
- IR discard 将 transaction fresh 的来源采集交给本 phase，图与资源计算仍执行；较早 hook 后的集合/index 对照及 post collection 各自取证。
- 显式 fresh 的资源文件保护共用当次 root-bound phase 队列，目录证明保持领域顺序；资源 copy/delete 保留各自时点的独立证明。
- 实际写入 handle/readback、恢复 CAS 及领域 postverify 保持各自的证明责任，不跨阶段或调用保存事实。

## 阶段内读取队列

调用方决定来源范围与事务阶段，队列执行给定路径及读取契约。

| 条件 | 执行方式 |
| --- | --- |
| 少于 1000 项 | 当前进程 async 读取。 |
| 达到 1000 项 | 同阶段使用一个独立 worker 串行同步读取。1000 是已观察的最小有益规模，并非最优交叉点。 |
| 父 Node permission 模型启用，或实际使用 `--input-type` | 预先选择当前进程 async 读取，不启动 worker；保留父执行约束，此分支不承诺 worker 加速。 |

正常 worker 继承 Node 原生执行参数，不提供 fast/unsafe 开关。结果按最多 64 路径、约 8 MiB 的软字节块交接，等待有序 consumer 消费后继续。字节阈值用于背压，不截断单文件，也不承诺精确内存峰值；正文完整读取。同步和异步共享安全规则，强 snapshot 保留真实 root/path、bytes、identity、mode 与父链。

单文件失败按原路径顺序交给领域，保留 Error 类型及可用系统 code。启动、协议或 worker 异常属于基础执行失败，不能自动切换读取模式重试。consumer 异常、取消或提前停止均先收束 worker，调用返回后不再后台读取或回调。写入、提交、权限、实际句柄证明与恢复不进入队列。

worker 从同一 skill 安装内的 URL 启动，分发包含其模块闭包，不依赖主仓库路径或另一 skill。生成一致性和隔离安装的真实 Node worker 测试分别证明文件闭包与可执行性。

## 事务事实与恢复

1. **预检**：不取得独占写锁、不写持久文件、不保存执行凭据；合作锁忙不构成预检前置门槛。
2. **执行准备**：轻量核对参数与集合路径后，在集合锁内完整准备一次并独立 fresh；锁忙可以先于深层领域错误。执行不自动运行锁外完整预演，`unchanged` 仍核对适用来源、成员和索引。
3. **写入与提交**：journal 仅记录实际完成的写入。正式事务以实际索引发布为提交点；候选创建以安全独占建立为提交点，更名以目标写集建立且旧位置退出为提交点，删除以对象退出受管集合为提交点。候选动作不制造正式索引。
4. **写后验收**：writer 返回后，独立核对实际目标 bytes、identity、mode 及相关来源和成员；通过后才报告适用的成功 review。
5. **收尾或恢复**：按提交事实和实际写集处理，分别保留验收、清理与解锁失败。

越过提交点不自动回滚。提交后验收失败或未知，保留已知 committed/changed，报告 `partial-or-unknown`；验收通过且仅清理或解锁未完，才是 `committed-cleanup-pending`。收尾失败非零，保留真实 mutation 和路径，分别诊断多个失败，不返回成功 review 或建议直接重试。无写入而解锁失败同样非零，但不虚构 committed。

提交前恢复只撤销仍匹配本事务 written bytes/identity/mode 的实际写集；旧路径仅缺失时独占恢复，索引同样 CAS。未写成员和后来编辑/新建的 winner 不被覆盖。只有完整旧范围与未选保护均已证明才报告 `rolled-back`；否则保留现场人工对账。此机制不承诺非合作外部编辑的原子隔离。

### 创建权限与实际句柄证明

`RecordWritePermissions` 区分互斥的精确 `mode` 与原生 `creationMode`：

| 权限意图 | 适用范围与保证 |
| --- | --- |
| 精确 `mode` | 保持已有来源、复制/恢复和已有索引的表示。 |
| 原生 `creationMode` | 仅用于不存在目标的独占创建，由系统应用进程 umask，不以 chmod 补足受限权限。DR 候选及首次正式索引请求 `0o666`，IR 请求 `0o600`；请求值不保证最终权限。 |

原生 writer 必须交接实际写入 FileHandle 的 dev、ino 和最终 mode，capture/readback 及恢复 CAS 均核对该证明。混用权限意图、对已有目标使用原生创建请求，在写入前拒绝，`unchanged` 也不能绕过。无实际 handle 证明的 opaque writer 不获得恢复所有权；已有表示的精确保护保持有效。

## 分发与验证

各领域同步器独立复制源码闭包。改动按消费关系同步生成、运行原生测试并维护 Case，最终运行完整变更门禁；命令见[项目工具链](../../docs/tooling.md#工具维护命令)。
