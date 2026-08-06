# Task Graph 文件锁与原子写入 npm 库调查

## 调查信息
- 核心问题: task-graph 是否应采用成熟 npm 库承接同主机跨进程文件锁、陈旧锁恢复和原子索引替换？
- 状态: 已结束
- 最新报告时间: 2026-08-06T21:53:35+08:00

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
