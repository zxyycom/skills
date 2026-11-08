---
title: "Rust 记录 CLI 当前候选的新进程常数成本与增长"
id: "261107-record-cli-current-process-cost-and-scale"
formedAt: "2026-11-07T15:06:08Z"
question: "当前 Rust 候选与现行 Node CLI 在合法私有输入上，新进程成本和不同实际工作量下的增长如何？"
tags:
  - "benchmarking"
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "record-cli"
  - "rust"
relations:
  - type: "复查"
    target: "261106-record-cli-final-candidate-performance"
    summary: "在当前候选与运行时边界下复查新进程性能"
---

## 形成时背景

2026-11-06 的 [正式候选新进程调查](./261106-record-cli-final-candidate-performance.md) 在当时冻结的 `8ba448ea`、32/100/500 条 fixture 上比较过两域查询与全量同步。本轮在新的源码和运行时保证下复查，不把旧结果当作当前分布。此后候选采用顺序本地事务、protocol v2，移除了跨阶段恢复等旧证明，并调整准备阶段索引读取；生产 TypeScript CLI、skill 分发和 updater 尚未切换。保障、输出与实现均有变化，实测差异不能全归因于 Rust 语言。2026-11-07 的 [事务 I/O 对照](./261107-rust-record-transaction-io.md) 仅每臂各一次且侧重普通更新与资源迁移，形成后实现又有变化，也不是本轮分布。

早期原型调查曾指出固定项可能遮蔽增长，以及旧 trace 普通边查重存在高直接度平方工作；随后另一轮移除了该特定查重。[固定成本调查](./261105-rust-query-fixed-cost-and-scale.md)、[复杂度调查](./261105-rust-query-algorithmic-complexity.md) 和 [图优化对照](./261105-rust-trace-aligned-graph-performance.md) 保留了这些历史条件；其原型、调用边界与本次不同，不能把旧结论直接贴到当前源码。

## 调查目的

在当前隔离构建的候选与现行直接 Node CLI 之间，先观察轻路径和单条业务路径的完整新进程成本，再分别增大索引数量、实际内容扫描数、图关系工作和局部新建时的集合存量。判断哪些增长已明显超过固定项、哪些仍被输出、机器波动或固定工作混合；保留可复算样本，但不把时间曲线当作算法复杂度证明，也不设生产 SLA。

## 调查范围与依据

**输入、构建与环境。** 主仓库起点干净、HEAD `c1161cf1db52cf2de9ba5e0829808e18ebdccf19`；使用 `node tools/record-cli/delivery/cli.ts build record-cli-perf-261107-main 0.1.0` 在 `dist/` 新目录以锁定、离线 release 构建，未安装到用户环境。manifest 的隔离源码树 SHA-256 为 `88c5ecaa22b7a42ba660b7c14a3e0c5300c85fb4174c5fc818792b25d976c072`；其清单中 316 个文件与测后工作树对应字节逐一相同。DR 二进制 SHA-256 `42bdfe5113c4a6ffa404efa54eb68f42a42003a92f51e3529b5ddd5ef8fe2a6b`，IR 为 `1e1aa4a14553239e2cbe22723d738ee53b3dc46b53ba9a355add3825c453ab20`；Node v26.8.2 可执行文件 SHA-256 `8a22a371fd85aecf5411636574309f6380fbc42694aaf0651a089a8ef9c44e52`。Rust/Cargo 1.98.1、Git 2.53.0、glibc 2.43；Linux x86_64 WSL2 kernel 6.18.33.2，AMD Ryzen AI 7 H 450，枚举 6 逻辑 CPU、`nproc` 为 4；`df` 显示 ext4、`stat -f` 显示 ext2/ext3。锁文件、两域运行脚本树和列举的直接依赖入口按字节守卫，未穷举所有传递依赖或系统库；完整资产和 fixture hash 见资源。

**预采样与选档。** 私有输入用确定性 Markdown 构造，两域原生产 CLI 分别 `sync-index`、`check`；不读取真实记录。 这些 fixture 位于主仓库 `dist/` 下，可发现主仓库 Git HEAD；TS 全量 check 对尚未进入该 HEAD 的私有前序发出演进复核 warning，发生在计时外的准备阶段，与下文正式 Node `new` 每次的空正文 scaffold warning 是两类不同诊断。预采样每臂每单元两次，独立留存，不合并到正式样本。IR 内容扫描 32/250/1200 条的 Node 中位约 328/631/1782 ms、原生约 9.6/13.4/30.8 ms，因完整扫描次数已可区分且 1200 低于 IR 2000 文件预算，正式沿用。IR list 和新建在小规模固定项仍明显，补探 5000 后原生约 26.8/44.4 ms，故这两组扩至 5000；metadata 也包括 5000。图先在 N=250 下试宽 8/40/200，原生大约仍落在 6–13 ms 的同量级范围，未声称分离；再固定 N=5000、深度 8，将宽从 8 扩至 2000，原生预采样约 31–33 → 49 ms，Node 约 490–498 → 533–560 ms，选择该组正式复核。单条 IR list 与两域 help 补充低成本路径。DR 正式增补 list 5000 与 content 32/250/1200；不同能力未机械套用同一阶梯。

**图和工作量。** 固定 N=5000 的 IR 图宽 8/2000 同时有各自的复杂归并事件、深链和普通宽分支，全集合边数分别 30/4014；指定 predecessor trace 实际输出 trace ID 17/2009，context 为空、frontier 为空且 coverage complete。两组不是只改一条局部边：全集图校验、事件、输出及排序均可能改变。Node JSON 输出分别 6322/715476 字节，原生 JSON 分别 4286/486352 字节；输出随宽度明显增长。内容搜索使用只命中一个固定 ID 的 query，独立断言命中数精确为 1、scan/results/previews 完整，故 32/250/1200 对应实际访问该数目的记录，而不是提前停止的总 N。

**计量和核对。** 预采样结束后先校验每组独立预期；list 检查 ID 和总数，search 检查 ID、精确计数和 coverage，trace 检查 trace/context/frontier/coverage 并比较两端解析后的完整 JSON；单条 list 独立核对一条身份与总数。TS list/search 为文本，原生是 protocol v2 JSON，不能声称逐字段等价。IR 新建每次在计时外恢复完全相同的私有状态，核对新候选完整字节、ID、实际已知写路径，以及排除该候选后的全树 hash，再移除该精确自建文件；没有 stage 或 Git pending 场景。示例脚手架及失败尝试见资源。两域生产 `check` 只是辅助来源，不是唯一 oracle。

墙钟从直接 `node <生产脚本>` 或原生 release 新进程启动至 stdout/stderr 完整收集和退出，不包括 Bun、cargo run、fixture 准备、写后核对或常驻宿主。固定种子在全部单元与两臂间随机交错；主批 2026-11-07 15:12:16–15:16:54 UTC，20 单元、每臂 20 次，共 800 次；DR 补批 15:17:18–15:18:35 UTC，5 单元、每臂 20 次，共 200 次。1000 次状态均为 0、无信号，逐次保留命令、时序、输出字节数及 SHA-256；查询输出逐次与事先核过的各臂输出 hash 相同。Node 新建每次 stderr 均含 309 字节的空正文 scaffold warning，原生该样例无 stderr，均真实计入墙钟；其余正式样本 stderr 为空。主代理另行只读复算全部 1000 条样本并核对 50 组统计与首尾守卫，另行重跑两域 5000 条 list 的身份与总数检查；后者是正确性复核，不作为额外性能样本。没有事后删离群值。中位数为中间两值均值，P95 为 nearest-rank 第 19 个值，仅是 20 样本描述，不是生产尾延迟。

墙钟两批分别在首尾对 fixture、资产与 manifest、316 个源码输入及快照、Node、领域运行脚本树、根锁文件和所列直接依赖入口计算守卫，批内相等；一次性测量脚本另留 SHA-256。守卫不证明窗口内每一瞬间或全部传递依赖未变化。主批中一次轻量进程快照显示本测量及常驻系统进程，协调方避免构建和 Gate，但没有隔离整机；仍可能有短暂竞争。操作系统缓存未清，前序构建、校验和预采样已访问文件：**新进程不是冷文件缓存，也没有测出纯进程启动**。首轮成功 help 预采样的第一次/第二次分别为原生 8.51/8.33 ms、Node 271.17/271.15 ms，但当时二进制和 Node 早已执行过，不能当首次安装或冷系统启动。主批 IR 轻路径约 4 ms、较早预采样和后续 DR 补批约 8–10 ms 的原生值提示跨窗口波动；不能用差值推算纯启动，也不能归因于领域差异。

**资源单列。** 主墙钟测量后另用小型 C `fork`/`exec`/`wait4` collector 采集 IR help、list 1/5000、content 1200 和图宽 8/2000，每臂各 5 次，共 60 次。固定 Node→原生顺序、stdout/stderr 定向 `/dev/null`；CPU 为 user+system，RSS 为 Linux `ru_maxrss`，不把此包装路径的 wall 与上表混合，也不声称逐次输出重新校验。独立 collector 的 `/bin/true` 约 1368–1544 KiB，64 MiB 触页程序约 66892–67064 KiB；触碰 128 MiB 的高 RSS 父进程经独立 collector 启动 `/bin/true` 得 1464 KiB，未见父高水位污染。短原生命令 CPU 多次为 0 µs，属计量分辨率边界，不表示零计算。资源批未自身显式执行首尾输入守卫；其结论是较弱的辅助观察，不扩大为墙钟批次的守卫证明。

## 调查结果与边界

在本机、本轮全部 25 个规模/场景单元中，原生与 Node 的两臂 20 次新进程均成功，原生的中位数和样本 P95 均低于同单元 Node；这说明当前候选在所测完整命令与输出组合中有明显低延迟，但不证明所有命令、平台或并发使用都有同样优势。下表单位 ms，格式为 `Node 中位/P95 → 原生中位/P95`；全部单元、输出和逐次样本见资源。

| 实际场景 | 小规模 | 中规模 | 大规模 |
| --- | --- | --- | --- |
| IR help / list 1 | help 270.34/294.07 → 3.75/4.66 | list 1：277.95/297.58 → 4.19/5.11 | — |
| DR help / list | help 259.20/275.15 → 9.84/10.39 | 32：273.82/298.52 → 4.26/4.97 | 5000：509.51/524.40 → 39.10/42.51 |
| IR list | 32：296.22/328.65 → 4.26/5.24 | 250：311.06/324.34 → 5.18/6.44 | 5000：510.36/570.26 → 28.34/30.82 |
| IR metadata search | 32：292.38/312.64 → 4.20/4.93 | 250：308.68/325.43 → 5.42/6.52 | 5000：509.46/541.22 → 35.68/39.69 |
| IR content 全扫描 | 32：333.52/360.17 → 4.75/7.29 | 250：623.81/674.39 → 8.86/9.54 | 1200：1815.47/1849.01 → 26.86/30.83 |
| DR content 全扫描 | 32：346.93/371.64 → 11.43/12.21 | 250：661.23/723.50 → 16.99/17.80 | 1200：1928.17/2035.07 → 41.30/44.30 |
| IR 新建候选 | 32：321.50/342.91 → 4.49/5.85 | 250：360.78/384.56 → 5.66/6.49 | 5000：938.91/978.05 → 37.17/40.45 |
| IR trace，N=5000 | 宽 8：509.24/544.59 → 29.20/33.79 | 宽 2000：550.26/575.14 → 44.34/49.87 | — |

当前候选 `tools/record-cli/src/queries/investigation/list.rs` 中，facets 遍历全集，筛选先处理匹配集合并排序再分页，因而即使 `limit=10`，输出条数不等于内部处理的集合大小；这是本轮放大 N 的具体机制依据，不是由时间拟合出的复杂度阶。

结果支持的具体认识是：单条业务路径与 help 都含显著的完整进程和 CLI 入口成本；32→250 的原生 list 增量接近数毫秒量级，不宜从小点确定增长规律，而 5000 点已高于同批小规模分布。IR content 32→1200 与新建 32→5000 有更明显增长；DR content 在自己的补测窗口也随实际扫描数增长。DR list 的 32/1200 条来自主批、5000 条来自后续补批，因此该行不是同一窗口的单变量增长曲线。IR 各项与 DR list 的 32/1200 条在主批，DR help、content 和 list 5000 在补批；跨批、跨域的绝对值差异不能归因于领域实现。图宽 8→2000 的原生中位增加约 15 ms，但同时输出从约 4 KiB 增至 475 KiB、输入边数及可达节点大增；它是有界完整 CLI 工作差异，不是纯构图耗时。

只读几何变化与源码阅读都不能把这几档时间拟合为某个大 O。当前 `tools/record-cli/src/queries/trace/selection.rs` 的事件归一化使用 `HashMap` 按共享事件身份聚合，仍有排序、去重和遍历；这与早期原型的逐 unit 两两查重不是同一实现，但这里没有插桩计数，也未覆盖所有复杂事件和高直接度形态，不能据此证明整个 trace 线性或排除其他超线性路径。

资源辅助观察的 5 次中位示例：IR content 1200 的 Node CPU 2255.59 ms、峰值 RSS 160404 KiB，原生 CPU 22.25 ms、RSS 9272 KiB；IR 图宽 2000 分别为 Node 897.82 ms / 171360 KiB、原生 36.62 ms / 24688 KiB。CPU 可包含并行线程的累计时间，故可能大于 wall；这不是 CPU 加速 SLA、各阶段归因或生产峰值内存保证。

未测合法空索引、真正首次安装/冷 OS 缓存、常驻调用、DR 图与普通写入、stage 和 Git pending、全量同步、Windows、资源迁移/大资产及超过本轮预算的内容扫描。零条 fixture 创建尝试失败的原因及后续未推断空索引合法性见资源；后续需要评估上述情形时应单独构造合法输入、校准对应调用边界并在当时源码重测。本轮没有切换生产、修改实现、提交或发布二进制。

资源保留形成时方法和数据而不是稳定测试入口：`*-samples.jsonl` 是原始逐次样本，`summary.jsonl`/`summarize.py` 可复算描述统计；`correctness.json`、`guards.json`、`environment.json` 保存预期与输入身份。生成和测量脚本引用当时工作区路径，仅用于审阅该次做法；大 fixture、二进制和依赖不作为报告资源。`fixture-notes.md` 记录失败、warning 与写入 oracle；collector 与其校准、资源样本独立于墙钟。

## 随附资源

- [addon-samples.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/addon-samples.jsonl)
- [collector-high-parent-calibration.json](./_resources/261107-record-cli-current-process-cost-and-scale/collector-high-parent-calibration.json)
- [collector.c](./_resources/261107-record-cli-current-process-cost-and-scale/collector.c)
- [correctness.json](./_resources/261107-record-cli-current-process-cost-and-scale/correctness.json)
- [environment.json](./_resources/261107-record-cli-current-process-cost-and-scale/environment.json)
- [expected-candidate.txt](./_resources/261107-record-cli-current-process-cost-and-scale/expected-candidate.txt)
- [fixture-notes.md](./_resources/261107-record-cli-current-process-cost-and-scale/fixture-notes.md)
- [fixtures-small.ts](./_resources/261107-record-cli-current-process-cost-and-scale/fixtures-small.ts)
- [fixtures.ts](./_resources/261107-record-cli-current-process-cost-and-scale/fixtures.ts)
- [formal-samples.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/formal-samples.jsonl)
- [guards.json](./_resources/261107-record-cli-current-process-cost-and-scale/guards.json)
- [measure-addon.ts](./_resources/261107-record-cli-current-process-cost-and-scale/measure-addon.ts)
- [measure-pre.ts](./_resources/261107-record-cli-current-process-cost-and-scale/measure-pre.ts)
- [measure-pre2.ts](./_resources/261107-record-cli-current-process-cost-and-scale/measure-pre2.ts)
- [measure.ts](./_resources/261107-record-cli-current-process-cost-and-scale/measure.ts)
- [pre-failed-help.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/pre-failed-help.jsonl)
- [pre-samples.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/pre-samples.jsonl)
- [pre2-samples.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/pre2-samples.jsonl)
- [pre3-samples.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/pre3-samples.jsonl)
- [private-script-guard.txt](./_resources/261107-record-cli-current-process-cost-and-scale/private-script-guard.txt)
- [resource-calibration.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/resource-calibration.jsonl)
- [resource-samples.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/resource-samples.jsonl)
- [resources.sh](./_resources/261107-record-cli-current-process-cost-and-scale/resources.sh)
- [rss-calibration.c](./_resources/261107-record-cli-current-process-cost-and-scale/rss-calibration.c)
- [summarize.py](./_resources/261107-record-cli-current-process-cost-and-scale/summarize.py)
- [summary.jsonl](./_resources/261107-record-cli-current-process-cost-and-scale/summary.jsonl)
