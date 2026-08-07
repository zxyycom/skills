# Task Graph 文件锁与原子写入 npm 库调查

## 调查信息
- 核心问题: task-graph 是否应采用成熟 npm 库承接同主机跨进程文件锁、陈旧锁恢复和原子索引替换？
- 状态: 已结束
- 最新报告时间: 2026-08-07T01:45:30+08:00

## 调查报告

### 现有候选无法缩减 task-graph 的关键事务协议
- 形成时间: 2026-08-06T21:53:35+08:00

#### 形成时背景

[`create-task-graph` design](../../../changes/create-task-graph/design.md) 要求索引存储在本地文件系统，由同一主机上的多个进程短时并发修改。锁等待上限是 5 秒；锁龄达到 60 秒只产生陈旧候选，只有记录的同主机进程已确认死亡时才能自动回收。锁还必须携带 owner token，并通过原子隔离与再次校验阻止旧持有者、释放者或两个回收者删除后来创建的新锁。

同一设计对提交路径另有硬约束：拒绝符号链接路径；在目标目录以 `wx` 创建临时文件；写入、文件 `fsync`、单次原子替换、尽力执行目录 `fsync`，再回读并按旧 revision、新候选 revision 或其他/不可读状态分类。替换调用一旦抛错，不得盲目重试，因为系统必须区分“尚未提交”和“提交结果未知”。这些语义共同构成 task-graph 的事务协议，不能只用“有 lock API”或“先写临时文件再 rename”替代。

仓库的[工具分发约定](../../tooling.md)还要求随 skill 分发的工具生成为自包含 ESM；引入原生 addon 会扩大构建、平台二进制和安装责任。

#### 调查目的

本轮调查比较已有 npm 库能否直接承接上述协议，或至少实质缩小自研代码与故障面。判断同时考虑包的采用规模、近期维护、依赖与分发形式、Windows 支持、源码实际语义以及仍需由 task-graph wrapper 承担的责任。结论采用“采用、部分采用、不采用”口径，不以使用第三方库本身为目标。

#### 调查范围与依据

需求依据是 2026-08-06 工作区中的 [`proposal`](../../../changes/create-task-graph/proposal.md)、[`design`](../../../changes/create-task-graph/design.md)、[`tasks`](../../../changes/create-task-graph/tasks.md) 和当时尚在实施中的 [`store.ts`](../../../tools/task-graph/src/store.ts)。候选覆盖纯 JavaScript 锁库 `proper-lockfile`、旧式锁库 `lockfile`、原生系统锁库 `fs-ext`，以及原子写库 `write-file-atomic`、`atomically`。

生态数据取自 2026-08-06 观察到的官方 npm 包页面和注册表元数据；npm 页面提供的是滚动周下载量，本报告用它作为采用规模的粗略代理，不将下载量等同于质量或安全性。活跃度、实现行为与已知限制取自各项目的官方 GitHub 仓库、对应版本源码和 README。没有安装候选、运行本仓库适配器、执行 Windows 故障注入或完成依赖供应链安全审计。

#### 调查结果与边界

**结论是不采用任何候选作为 task-graph v1 的运行时依赖。** `write-file-atomic` 和 `proper-lockfile` 可以作为实现与测试案例的成熟参照，但这不构成代码依赖或协议委托。现有候选隐藏的默认行为与本项目硬约束冲突，而 wrapper 仍需实现 owner token、PID 死亡确认、双回收者 ABA 防护、单次替换、提交结果分类和回读校验；采用后没有把最难的责任移出 task-graph，反而增加了隐式重试、路径解析或原生构建边界。

| 候选 | 生态与活跃度快照 | 源码能够保证的行为 | 与 task-graph 的关键冲突 | 判断 |
| --- | --- | --- | --- | --- |
| [`proper-lockfile@4.1.2`](https://www.npmjs.com/package/proper-lockfile) | 周下载约 2051 万、约 1859 个 dependents；最后发布于 2021-01-25，[仓库](https://github.com/moxystudio/node-proper-lockfile)约 284 stars | [源码](https://github.com/moxystudio/node-proper-lockfile/blob/v4.1.2/lib/lockfile.js)用原子 `mkdir` 取锁，以 `mtime` 更新和判断 stale；默认先 `realpath` | stale 后直接移除锁目录，没有持久化 owner token、同主机 PID 死亡确认或隔离后 token 复核；[README](https://github.com/moxystudio/node-proper-lockfile/tree/v4.1.2)明确承认无法检测“手工移除后立即被另一进程重取”的 compromised 情形 | 不采用；时间型 lease 不能替代保守回收协议 |
| [`lockfile@1.0.4`](https://www.npmjs.com/package/lockfile) | 周下载约 431 万；最后发布于 2018-04-17，[仓库](https://github.com/npm/lockfile)已于 2021-08-11 归档 | [源码](https://github.com/npm/lockfile/blob/v1.0.4/lockfile.js)通过创建文件取锁，以经过时间判断 stale，解锁时关闭并删除文件 | 无 owner token、PID 死亡确认和 ABA 防护，且已归档 | 不采用 |
| [`fs-ext@2.1.1`](https://www.npmjs.com/package/fs-ext) | 周下载约 5.2 万、约 76 个 dependents；最后发布于 2024-11-04，[仓库](https://github.com/baudehlo/node-fs-ext)约 109 stars | [原生源码](https://github.com/baudehlo/node-fs-ext/blob/v2.1.1/fs-ext.cc)在 POSIX 使用 `flock`，Windows 使用 `LockFileEx` / `UnlockFileEx` | 原生 addon 需要平台构建或二进制交付，不能直接进入当前自包含 ESM 分发；它只解决锁互斥，不承接 JSON owner、回收审计或原子写结果分类。npm 元数据未声明 license，仓库则包含 MIT license，发布元数据还需澄清 | 当前不采用；只有分发契约改变且完成 Bun/Node/Windows 安装与进程崩溃实测后才值得重新评估 |
| [`write-file-atomic@8.0.0`](https://www.npmjs.com/package/write-file-atomic) | 周下载约 9316 万、约 1740 个 dependents；发布于 2026-05-08，[仓库](https://github.com/npm/write-file-atomic)近期仍维护 | [源码](https://github.com/npm/write-file-atomic/blob/v8.0.0/lib/index.js)写临时文件、文件 `fsync` 后 `rename`，并在同一进程内串行化同路径写入 | 已存在目标会经 `realpath` 跟随；临时文件用 `w` 而非 `wx`；没有目录 `fsync`、提交后回读、old/new/unknown 分类或可注入的替换点；不提供跨进程锁 | 不采用；生态成熟但协议 wrapper 仍需重写核心提交路径 |
| [`atomically@2.1.1`](https://www.npmjs.com/package/atomically) | 周下载约 1229 万、约 64 个 dependents；发布于 2026-02-08，[仓库](https://github.com/fabiospampinato/atomically)近期仍活跃 | [源码](https://github.com/fabiospampinato/atomically/blob/v2.1.1/src/index.ts)写临时文件并 `fsync` 后重命名，提供同进程队列和文件系统操作重试 | 自动解析符号链接、临时文件使用 `w`，默认会重试包括 `rename` 在内的操作；没有目录 `fsync`、回读和提交结果分类。README 的“零依赖”描述与当前注册表列出的两个运行时依赖不一致 | 不采用；隐式重试直接破坏单一提交点的可判断性 |

这里的“不采用”不是认为 Node 文件系统原语天然安全，而是确认第三方库没有封装本项目真正需要的协议。保持一个基于 Node core `mkdir`、`open('wx')`、`rename`、`fsync` 和回读的窄存储层，反而能让每个提交点、重试边界和故障注入点保持可见。不得为了复用而再增加通用 lock provider 或 atomic writer 抽象；若以后出现完整满足协议的候选，再以适配代码实际减少为准重新判断。

#### 建议的实现与验收重点

1. stale recovery 在触碰 canonical lock 前，必须先通过 `wx` 创建绑定旧 owner token 与 reclaimer identity 的 recovery-election marker，或使用等价的 generation CAS，取得该 generation 的唯一恢复权。winner 在 `rename` 前必须同时重读 canonical old owner 与 marker token；任一不匹配都应放弃并从 canonical 重新读取，未赢得 election 的回收者绝不能先隔离 canonical lock 再判断。winner 在隔离后仍应核对隔离副本的 owner token，但该校验只确认隔离的是预期旧锁，不能取代 rename 前的唯一恢复权选举。
2. 提交和释放前都应重新核对 owner token。旧持有者不得提交，旧释放者不得删除新锁；两个回收者同时观察同一 stale lock 时只能有一个完成隔离。
3. 原子写测试应分别注入临时文件创建、写入、文件 `fsync`、关闭、替换前、替换抛错但实际已提交、目录 `fsync` 和回读失败；替换调用必须至多一次，抛错后只能依靠回读分类，不能自动重试。
4. Windows 验收应至少覆盖并发读写、进程异常退出、目标被占用或安全软件短暂干预时的替换错误，并验证磁盘上只出现完整旧文档或完整新文档。目录 `fsync` 和断电持久性属于平台边界，不能由普通单元测试或库名称推断为已保证。
5. 当前“先检查路径不是符号链接再打开”的方式仍可能存在检查与使用之间的竞争窗口；所有候选同样没有提供满足本协议的 no-follow 事务。若威胁模型包含本机恶意并发改写路径，需要另立平台级设计，而不是把现有检查描述成完整防护。

#### 不可外推的边界

本结论只适用于 design 明确限定的同主机、本地文件系统和短事务；网络文件系统、跨主机协调、长时间 lease 与分布式一致性不在范围内。操作系统文件句柄通常会随进程结束而释放，因此 `fs-ext` 理论上能减少 stale lock 协议，但这是对 OS 句柄生命周期的推论，不是本轮跨平台实测结论。

进程 PID 可能被复用，单凭 hostname 与 PID 不能在任意长时间后证明仍是同一进程；候选库也没有替 task-graph 解决这一点。若 60 秒窗口和当前进程探测不足以接受，应增加进程启动身份或采取更保守的“不自动回收”策略。包的下载量、stars 和近期 commit 只是采用与维护信号；若未来重新考虑依赖，必须重新核验版本、license、维护者、安全记录、Node/Bun 支持和 Windows 行为。

### 约束收窄后采用原生锁与原子写库
- 形成时间: 2026-08-07T01:45:30+08:00

#### 形成时背景

上一份报告的“不采用”建立在 task-graph 必须自行保存 owner token、PID、heartbeat、stale 候选、generation、reclaimer 和 quarantine，并对陈旧锁执行保守恢复这一组硬约束上。在这些约束下，候选库确实没有接走最复杂的协议责任。

后续设计改变了前提：task-graph 的短事务只承诺同一主机的本地文件系统和遵守 CLI 协议的写入者；接受原生 advisory lock 在句柄关闭或进程退出时释放，存活但卡死的持有者只得到 5 秒有界超时，不再自动抢锁。用户也接受在首次 mutation 前显式联网，把锁定 native addon 安装到 skill 自己拥有的用户工具目录；`.node` 仍不进入 Git 或 skill zip。原子提交只要求成熟库承接同目录临时写入、文件 `fsync` 和单次 rename，task-graph 继续拥有路径门禁、完整候选校验、回读及 old/candidate/unknown 分类。

#### 调查目的

本轮复核原结论的适用边界，并确认在新约束下：

1. `fs-native-extensions@1.5.0` 是否足以承接跨进程短锁，且能够保持安装、加载和平台兼容性失败关闭。
2. `write-file-atomic@8.0.0` 是否实际缩小提交实现，同时不隐藏 task-graph 必须保留的单次提交和结果分类。
3. 哪些边界仍不能从库名称、N-API、普通测试或成功安装外推。

#### 调查范围与依据

依赖判断继续以 [`fs-native-extensions@1.5.0`](https://github.com/holepunchto/fs-native-extensions/tree/v1.5.0) 和 [`write-file-atomic@8.0.0`](https://github.com/npm/write-file-atomic/tree/v8.0.0) 的正式源码、包元数据与许可证为依据。实施事实来自 [`simplify-task-graph-json-transactions` design](../../../changes/simplify-task-graph-json-transactions/design.md)、精确的 [runtime manifest](../../../tools/task-graph/references/runtime/package.json) 与 [npm lockfile](../../../tools/task-graph/references/runtime/package-lock.json)、[`runtime.ts`](../../../tools/task-graph/src/runtime.ts)、[`store.ts`](../../../tools/task-graph/src/store.ts) 及对应 runtime、store、CLI 和生成产物测试。

当前验证覆盖 Windows 上的真实 addon 探针、独立描述符互斥、进程级 claim 竞争、持锁子进程退出、安装并发收敛、安装后离线 mutation、atomic writer 故障分类和分发树无 `.node`。POSIX 进程组终止与符号链接相关 case 在 Windows 上保守跳过，交给受支持的 POSIX CI 运行；没有验证网络文件系统、恶意本机路径竞争或断电后的目录元数据持久性。

#### 调查结果与边界

**当前结论是采用 `fs-native-extensions@1.5.0` 和 `write-file-atomic@8.0.0`，但只委托各自能够完整拥有的窄责任。** 旧报告仍准确描述旧 owner/stale recovery 协议；它不适用于已经明确删除该协议、接受显式 native runtime 的当前约束。

`fs-native-extensions` 只承接稳定旁路文件上的 advisory `tryLock(fd)` 与 `unlock(fd)`。Task-graph 仍负责以 `open("a+")` 打开普通文件、单调时钟轮询、5 秒门禁、finally 中 unlock/close 和错误分类。锁文件长期保留且为空；不保存 owner metadata，也没有基于年龄、PID 或 generation 的恢复动作。进程退出自动释放是操作系统句柄行为，不代表网络文件系统或不遵守协议的进程受到互斥。

Native addon 不随 skill 打包。Skill 分发精确 manifest 与 npm lockfile，使用 `npm ci --ignore-scripts --omit=dev --no-audit --no-fund` 安装到不可变 runtime ID 目录。加载前逐项核对 lockfile 中所有非 optional 包的目标 realpath 和精确版本，再以目标 runtime 的 `createRequire()` 解析入口；任何祖先 `node_modules` fallback、API 不匹配或真实探针失败都报告不兼容。成功探针只证明当前 Node、平台和架构组合可用，不外推其他平台。

`write-file-atomic` 承接同目录临时文件、文件 `fsync` 与 rename，并内联到生成 ESM。Task-graph 对每个候选只调用一次，调用抛错后回读完整文本：仍为旧原文时报告 `WRITE_FAILED`，已经是候选原文时按成功，其他内容或回读失败时报告 `WRITE_OUTCOME_UNKNOWN`。库的同进程队列不替代跨进程 native lock；已有目标的 realpath 解析也不替代 task-graph 的符号链接门禁。

采用 `write-file-atomic@8.0.0` 同时固定分发 CLI 的 Node engine 为 `^22.22.2 || ^24.15.0 || >=26.0.0`。Bun 仍只运行仓库构建和测试。`runtime info`、help、只读查询和模块导入不加载 addon；所有 mutation 在读取 apply 文件、stdin 或触碰工作区前检查 engine 和 runtime。只有显式 `runtime install` 可以联网或写用户 tool home。

两项采用都不提供目录 `fsync`。因此普通成功表示原子替换和随后回读成立，不声称突然断电后目录项已经稳定落盘。路径检查与实际打开之间仍存在非恶意本机路径威胁模型下接受的竞争窗口；需要 no-follow 或恶意并发防护时必须另立平台设计。

#### 后续复核条件

出现以下任一情况时追加调查，而不是扩大当前结论：

1. 需要支持新 Node 主版本、未受测平台、网络文件系统或按平台预构建制品。
2. 锁定依赖、传递闭包、许可证、安装脚本或 native 加载方式发生变化。
3. 需要断电后的目录级持久性、no-follow 路径安全或不遵守 CLI 的本机写入者互斥。
4. 真实故障表明 5 秒 advisory lock、单次 atomic write 或当前 old/candidate/unknown 分类不足以恢复。
