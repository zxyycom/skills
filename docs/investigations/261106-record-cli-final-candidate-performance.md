---
title: "决策与调查 CLI 正式 Rust 候选的单次进程性能"
id: "261106-record-cli-final-candidate-performance"
formedAt: "2026-11-06T12:24:56Z"
question: "冻结正式 Rust 候选在两域真实单次进程查询与同步中，相对现行 Node CLI 的端到端延迟和规模变化如何？"
tags:
  - "decision-records"
  - "investigation-report"
  - "native-cli"
  - "performance"
  - "rust"
relations: []
---

## 形成时背景

本 Change 正在评估决策记录（DR）与调查报告（IR）的 Rust CLI 候选；该候选尚未接入生产。2026-11-05 的四份 Rust 查询实验是早期原型在当时环境中的认识；该原型源码不作为正式候选，历史倍数不直接用于本轮。本报告先比较冻结的初轮候选和现行 Node CLI，随后对最终 Linux-only 源码作同一问题的补测；两轮源码、窗口和样本独立保留，不把任一轮证据代入其他源码。生产 TS 入口、用户安装、打包与 updater 均未切换。

## 调查目的

在相同合法私有记录集上，比较两域 list、metadata/content search、不同图形和预算下的 trace，以及全量重建索引的端到端延迟；检查规模变化、分布和反例。结果支持当前候选性能判断，不承诺统一 SLA，也不证明所有命令、外部使用方式或其他平台性能。

## 调查范围与依据

以下列出初轮条件与两轮共用的输入、正确性和计量方法；最终 Linux-only 补测的独立条件及结果见结果节。

- **版本与构建**：Git commit `be1e9c4053e292a0ea3d0959f275e4cc1295f677`。使用 delivery 公开入口从隔离工作树快照以 `cargo build --release --locked --offline` 构建 `x86_64-unknown-linux-gnu`，源快照 SHA-256 为 `74cd57dfc4e5e69d2abb413e21e621b674141da59d57812015c5d6fc65f0140b`。构建后独立回算工作树与隔离快照的 349 个源码输入文件：路径集合和提交中相应文件一致、工作树无差异、摘要相同。DR 制品 SHA-256 为 `8b436d00ebb8e809514b3526595169a3f89b9bd5b38f4c1c521dbda27686354b`，IR 为 `b94281d72da7bde7689286448ac2fb70cd1a3b7ecb42cbbb02fd2596e667fa0c`；两者分别 7,640,448 和 7,640,472 字节。版本分别为 Node v26.8.2、Rust/Cargo 1.98.1、Git 2.53.0、glibc 2.43。工具链及直接依赖入口指纹见环境资源；传递依赖全部字节并未逐一守卫。
- **机器和条件**：Linux x86_64、WSL2 kernel `6.18.33.2-microsoft-standard-WSL2`，AMD Ryzen AI 7 H 450；系统枚举 6 个逻辑 CPU，`nproc` 显示当前可用 4 个。`df -T` 将文件系统标为 ext4，`stat -f` 返回 ext2/ext3 的共同 magic 名称。2026-11-06 12:10:36–12:24:01 UTC 测量；协调方暂停其他本地重任务，但未隔离整机。10 秒全机忙碌率采样中位 28.82%、最大 32.28%，其中包含本任务自身；进程快照未见明显其他重任务，不能据此证明无竞争。新进程不等于冷磁盘：未清 OS cache，缓存可能为暖。
- **输入**：确定性私有集合分别 32、100、500 条，两个领域各一套；可调宽／深分别 5/5、10/10、24/16。DR 关系边分别 17、27、47，IR 分别 21、36、70。包含拆分、深链、归并，DR 额外重划，IR 额外普通宽分支；其余记录为无边填充，不能将总条数当成图中连通节点数。输入树 hash 和随机种子各见环境资源，生成后均经旧域 CLI 全量 `sync-index`、`check`。
- **正确性**：每规模、每域分别运行 list、两种 search、五种事件／链 trace，IR 另有普通宽分支 trace；手工预期核对 ID、计数、coverage、frontier、context 及阻断事件，并将各 trace 的旧/新 JSON 完整对象差分。旧版 list/search 不提供同形 JSON，旧文本和新 JSON 分别验证预期 ID、计数或完整性，不声称逐字段等价。每次 sync 各自复制私有 fixture、删除副本索引并在计时外核对新索引逐字节等于旧 TS 生成基准、其他文件不变，再由旧 CLI `check`。准备和校验不混入计时。每次只读计时输出还须与事先验过的同臂输出 hash 一致。
- **计量**：每规模 19 场景、两臂各 1 预热及 20 正式样本，共 2,280 个正式样本和 114 个预热；所有 2,394 次新进程退出成功、无 stderr，首尾输入与资产守卫通过。每组先进行校验和预热，再以固定种子随机交错调用真实 Node CLI 与原生 release 二进制；墙钟含进程启动和 stdout 完整收集，不含 Bun、常驻宿主、fixture 复制或写后验证。中位数使用两中间值均值，P95 使用 nearest-rank，即 20 个样本中第 19 个。场景与调用、字节数、逐次时间和状态保存在资源中。

## 调查结果与边界

最终 Linux-only 候选 `8ba448ea` 在所测机器的 57 个规模／领域／场景单元中，端到端中位数与 P95 均低于各自的 Node 对照；2,394 次采样进程全部成功。500 条组有一段原因未明的 Node 样本波动，所有样本均保留。这是特定工作负载和环境的观察，不是纯语言性能结论或其他平台的证明。初轮 `be1e9c4` 与补测各自的条件、身份和数据分别保留。

### 最终 Linux-only 源码补测（2026-11-06）

在初轮后，候选经历运行时边界修复和 Linux-only 范围收敛；初轮 `be1e9c4` 结果不证明后续源码。本次为回答同一个端到端问题，独立构建并重新测量 commit `8ba448ea45681525f1237d82846c08e3e8410215`：通过 delivery 公开入口从隔离快照执行 `cargo build --release --locked --offline`，目标 `x86_64-unknown-linux-gnu`。快照、工作树与 manifest 对 346 个文件回算一致，路径清单与提交一致，快照 SHA-256 为 `638ec2528e3d1e87c1156f8c3aa2bf43eb36300e403f16e140ad057c68e56f19`；DR 可执行文件 SHA-256 为 `7ed36f8faa5cd161cb78a7539db4daf226a85ee9d0f2412e285ad3dd54248927`，IR 为 `f68ced932f1f840c40cdfa0a6f9dbb77ca486bf6ba153b0b11ff1672a0606a28`。Node v26.8.2、Rust/Cargo 1.98.1；机器、WSL2 kernel 和文件系统与初轮同类，完整信息与直接依赖入口 hash 保留在本轮环境资源中。源码制品 hash 不替代工具链、系统库或所有传递依赖字节的证明。

三套私有输入树与初轮 hash 完全相同，规模、图宽深和边数仍为上文所列；旧 Node CLI 脚本树一致，benchmark 执行脚本未变，其目录 hash 因 README 的平台范围表述变化而不同。每规模复验 17 个只读场景的独立预期及旧/新 trace JSON 整对象差分，并分别在两域、两臂执行 4 次独立副本 sync 预检；这些准备均通过。正式采样继续每规模 19 场景、两臂各 1 次预热和 20 次正式样本，即 2,394 次独立进程（其中正式 2,280 次），每次只读输出 hash 与已验证输出一致；每次 sync 的独立副本重建、写后逐字节及旧 CLI check 仍按上文执行。所有子进程退出成功且 stderr 为空，三组起止输入与资产守卫通过。采样顺序、实际命令、输出大小和逐次分布见新增 `runtime-*` 资源；旧 13 个资源原字节不变。

本轮窗口为 2026-11-06 14:09:51–14:23:37 UTC；协调方暂停其他本地重任务，仍未隔离宿主或清空 OS cache。82 个 10 秒全机 CPU 忙碌率观察中位 28.64%、最大 31.85%，包含本任务；一次进程快照未见其他明显重作业，不能证明窗口没有短暂竞争。新进程启动不等于冷盘。补测 57 个规模／域／场景单元的原生中位数与 P95 均低于同单元 Node 值，未观察到这两个指标退化；中位数比值约 11.51–83.66。旧 CLI 的 list/search 是文本、候选为 JSON；trace 虽同形但排版不同，输出字节和序列化工作量不完全一致，不能将比值解释为纯语言、算法或内核收益。初轮与补测是独立时间窗口，跨轮差异不证明任何源码改动导致的变化。

下表单位毫秒，为 `Node 中位/P95 → Rust 中位/P95`；其余拆分、预算、深度 frontier、归并／重划和普通宽分支场景的全部分布见 `runtime-summary-*` 和 `runtime-samples-*`。

| 域／场景 | 32 条 | 100 条 | 500 条 |
| --- | --- | --- | --- |
| DR list | 271.61/289.24 → 7.95/9.10 | 282.93/309.30 → 3.67/10.46 | 308.87/364.25 → 5.93/7.14 |
| IR list | 290.03/308.17 → 8.06/9.09 | 298.33/304.01 → 3.57/9.70 | 339.05/402.55 → 6.06/7.39 |
| DR metadata search | 278.30/287.40 → 7.89/8.72 | 284.27/296.87 → 3.94/10.53 | 324.69/363.68 → 7.23/10.08 |
| IR metadata search | 291.39/307.42 → 8.54/9.34 | 297.63/311.96 → 3.70/10.66 | 330.23/387.30 → 6.63/7.37 |
| DR content search | 345.49/364.97 → 10.11/10.88 | 438.85/464.80 → 8.96/15.47 | 1026.79/1203.88 → 32.09/37.70 |
| IR content search | 335.98/354.67 → 5.31/10.56 | 429.62/441.61 → 8.36/15.24 | 942.34/1329.73 → 28.25/30.58 |
| DR 宽深 trace | 278.95/293.94 → 8.20/9.13 | 281.94/292.27 → 3.51/10.62 | 312.79/348.82 → 6.18/7.05 |
| IR 宽深 trace | 290.17/306.12 → 8.59/9.12 | 300.99/311.12 → 4.09/10.86 | 336.65/386.83 → 5.97/6.92 |
| DR 全量 sync | 411.85/421.01 → 22.68/23.34 | 636.89/660.55 → 40.02/45.52 | 1970.26/2293.83 → 171.18/193.49 |
| IR 全量 sync | 459.30/475.35 → 20.33/22.61 | 652.74/673.24 → 35.89/43.81 | 1832.56/2054.12 → 153.33/163.07 |

500 条组部分 Node 样本在 14:20:31–14:21:08 UTC 成簇偏高：例如 DR split-budget 中位 316.36 ms、P95 567.91 ms、最大 571.33 ms，IR 同场景最大 766.61 ms。全机 CPU 的 10 秒窗口未显示超出本轮常见范围的明显异常，但不能排除更短暂的宿主、磁盘或其他竞争；没有足够证据确认原因或界定受污染样本，故不剔除这些值。该波动以及小样本情况下中位数和 P95 的分离均限制单个倍数的稳定性，不降低对上文输出表示、缓存及未测阶段边界的要求。

本补测支持最终 Linux-only 候选在所测机器和场景下的端到端性能判断，不证明额外平台、其他命令、CPU 时间、RSS、纯启动、纯 I/O、构图、线上安装或并发使用的性能。没有运行任何生产切换或发布；后续接线仍需另行授权。

### 初轮端到端分布

初轮 57 个“规模 × 域 × 场景”单元中，原生臂的中位数和 P95 均低于对应 Node 臂，未观察到该指标退化；各单元中位数之比约 11.45–86.39 倍。但旧版 list/search 输出文本、候选输出 JSON，trace 两边虽为同形 JSON 但排版不同，输出序列化和字节工作量并非完全一致，不能将此比值归因于纯语言或纯内核。不同规模图宽、深、边数及输出量也同时变化，以下不是控制单变量的复杂度曲线。

表中单位为毫秒，格式为 `Node 中位/P95 → Rust 中位/P95`；完整 57 单元见各规模 summary 和逐次样本。

| 域／场景 | 32 条 | 100 条 | 500 条 |
| --- | --- | --- | --- |
| DR list | 274.47/286.29 → 8.59/9.49 | 277.73/290.09 → 3.68/10.82 | 303.75/313.23 → 5.92/6.62 |
| IR list | 288.37/301.71 → 8.17/10.39 | 296.42/319.90 → 3.51/9.71 | 317.74/339.82 → 5.66/6.35 |
| DR metadata search | 276.84/287.77 → 8.51/10.08 | 284.00/301.11 → 4.08/10.37 | 303.98/321.18 → 6.92/7.47 |
| IR metadata search | 287.91/307.06 → 9.33/10.25 | 297.83/311.20 → 3.52/10.48 | 321.22/337.37 → 6.27/6.79 |
| DR content search | 342.42/371.69 → 11.03/12.76 | 440.73/448.97 → 9.04/15.28 | 986.03/1023.48 → 31.03/33.44 |
| IR content search | 336.07/361.19 → 6.19/10.95 | 422.75/438.02 → 8.07/14.85 | 911.30/949.66 → 27.37/29.42 |
| DR 宽深 trace | 274.42/290.18 → 8.61/10.17 | 277.60/296.81 → 3.44/10.85 | 299.63/312.06 → 6.14/6.88 |
| IR 宽深 trace | 292.01/299.73 → 8.81/10.52 | 294.53/305.62 → 3.67/10.52 | 319.20/338.44 → 5.75/6.64 |
| DR 全量 sync | 419.46/434.15 → 23.78/25.76 | 634.19/668.76 → 39.16/45.75 | 1969.83/2022.35 → 172.01/179.28 |
| IR 全量 sync | 456.91/467.40 → 19.21/23.15 | 647.95/668.76 → 35.13/42.02 | 1837.79/1852.93 → 153.85/158.77 |

观察到的最小中位比是 500 条 DR sync 的约 11.45 倍；这不代表更大集合或其他写操作仍有该收益。500 条 DR list 的旧文本为 1,408 字节、新 JSON 为 4,422 字节；IR 分别为 1,179 和 3,406 字节。500 条宽深 trace 两边语义对象相等，但 DR 旧／新输出为 20,781／14,620 字节，IR 为 14,914／10,086 字节。普通宽度预算、拆分、深度 frontier 和复杂事件闭合的其余端到端结果保留在 summary，不从更小结果集推断收益。

32 条 DR list 的原生 20 样本出现约 3.01–3.62 ms 与 8.25–9.56 ms 两段；100 条同场景中位 3.68 ms，但 P95 10.82 ms。此波动使一个中位数倍数不稳定；初轮未识别原因，不将其归咎于调度、启动或任何特定代码。三组分别独立随机交错，跨组与跨命令差值不能当成纯扫描、构图、I/O、渲染或进程启动净成本；每条曲线仍包含全部端到端固定成本。

### 初轮判断与未覆盖项

初轮候选在本机、这批合法工作负载中直接 CLI 延迟明显低于 Node 对照，且随着 500 条全内容扫描和 sync 工作量增大，绝对耗时增加可被观测；这支持保留候选继续进行整体验收，不证明某个算法复杂度、性能差异的因果来源或生产迁移决策。没有单独测量进程启动分量、I/O、构图阶段、CPU 时间或 RSS；未测的值不以跨场景差值替代。未进行冷缓存、Windows 原生性能、更多并发、真实用户数据、npm 启动器或线上安装性能测试。Windows 原生功能 CI 不是 Windows 性能证据。

资源中的 stdout 含生成的私有 fixture 文本而非真实记录；逐次数据保留原始测量、命令、状态和输出 hash，供复核而非作为未来自动运行结果。正式 Git 提交只固定候选输入，不代表已发布原生包、切换生产入口、远端安装成功或授权后续生产接线。

## 随附资源

- [correctness-100.json](./_resources/261106-record-cli-final-candidate-performance/correctness-100.json)
- [correctness-32.json](./_resources/261106-record-cli-final-candidate-performance/correctness-32.json)
- [correctness-500.json](./_resources/261106-record-cli-final-candidate-performance/correctness-500.json)
- [environment-100.json](./_resources/261106-record-cli-final-candidate-performance/environment-100.json)
- [environment-32.json](./_resources/261106-record-cli-final-candidate-performance/environment-32.json)
- [environment-500.json](./_resources/261106-record-cli-final-candidate-performance/environment-500.json)
- [runtime-correctness-100.json](./_resources/261106-record-cli-final-candidate-performance/runtime-correctness-100.json)
- [runtime-correctness-32.json](./_resources/261106-record-cli-final-candidate-performance/runtime-correctness-32.json)
- [runtime-correctness-500.json](./_resources/261106-record-cli-final-candidate-performance/runtime-correctness-500.json)
- [runtime-environment-100.json](./_resources/261106-record-cli-final-candidate-performance/runtime-environment-100.json)
- [runtime-environment-32.json](./_resources/261106-record-cli-final-candidate-performance/runtime-environment-32.json)
- [runtime-environment-500.json](./_resources/261106-record-cli-final-candidate-performance/runtime-environment-500.json)
- [runtime-samples-100.jsonl](./_resources/261106-record-cli-final-candidate-performance/runtime-samples-100.jsonl)
- [runtime-samples-32.jsonl](./_resources/261106-record-cli-final-candidate-performance/runtime-samples-32.jsonl)
- [runtime-samples-500.jsonl](./_resources/261106-record-cli-final-candidate-performance/runtime-samples-500.jsonl)
- [runtime-summary-100.json](./_resources/261106-record-cli-final-candidate-performance/runtime-summary-100.json)
- [runtime-summary-32.json](./_resources/261106-record-cli-final-candidate-performance/runtime-summary-32.json)
- [runtime-summary-500.json](./_resources/261106-record-cli-final-candidate-performance/runtime-summary-500.json)
- [runtime-window-monitor.jsonl](./_resources/261106-record-cli-final-candidate-performance/runtime-window-monitor.jsonl)
- [samples-100.jsonl](./_resources/261106-record-cli-final-candidate-performance/samples-100.jsonl)
- [samples-32.jsonl](./_resources/261106-record-cli-final-candidate-performance/samples-32.jsonl)
- [samples-500.jsonl](./_resources/261106-record-cli-final-candidate-performance/samples-500.jsonl)
- [summary-100.json](./_resources/261106-record-cli-final-candidate-performance/summary-100.json)
- [summary-32.json](./_resources/261106-record-cli-final-candidate-performance/summary-32.json)
- [summary-500.json](./_resources/261106-record-cli-final-candidate-performance/summary-500.json)
- [window-monitor.jsonl](./_resources/261106-record-cli-final-candidate-performance/window-monitor.jsonl)
