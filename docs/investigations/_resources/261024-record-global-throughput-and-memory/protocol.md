# 本轮计量与审查协议

## 输入与执行边界

- 测量来源固定为 `f381715c0bfddd015503544c0fe38e8889809600` 的隔离复制；DR 95、IR 85。正常时延运行真实 Node 生成 CLI，源码与两域生成 runtime 的 247/262 个模块经去生成头、恢复 shebang 注释后逐字相等，并做每域三条来源的 source/generated Node smoke。没有把后来主仓库 HEAD 变化当作测量输入。
- Node v26.8.2；Bun 1.4.2 仅核对版本，本轮计时入口不是 Bun。没有安装依赖、联网、修改环境设置或修改生产实现。原型只存在 `$WORK/proto`，可以删除副本恢复。
- fixture 全部为非 Git 目录、无关系、无资源、无候选；每域 10,000 份来源。初始索引由真实 baseline `sync-index` 建立。每次矩阵/DR AB 前还原索引和第一份正文；changed/preflight 在第一份正文追加同样 35B UTF-8 文本，投影不改、来源 revision 改。准备、恢复、全树 SHA/mode 核对不进入 timed window。
- 所有样本均为新 Node 进程；fixture 准备及计时前逐文件 SHA 读取使其属于页缓存已暖的观察，不是 drop-cache 冷盘、持续服务或跨调用缓存实验。不强制 GC、不固定频率/核心、不改变并发设置。达到 1000 项的现有一个 reader worker、64 路径/约 8MiB 软交接块照常执行。

## 不同窗口不得混算

1. **原矩阵**：S0009–S0040，8 场景各 3 正常 + 1 诊断，属于租约开始 16:00:29 UTC 到 AB 环境建立 16:08:01 UTC 之间的顺序观察。早期没有逐样本 ISO 时间，只保留原顺序、argv、wall/CPU/RSS 和计数，不能补造更精确窗口。外部工作区的另一项性能采样曾并行，16:04 左右进程表观察其 CPU 较高；16:06:32 再观察时不再出现。不干预外部进程。
2. **依赖闭包变化**：原矩阵的诊断 loader 实际发现 `$EXTERNAL_OPTIONAL/supports-color/index.js`，9.4.0、SHA `13b5fc8a0b139d257260d1e625726744609c24a3b58535afbb602389997e60d6`；并非完全封闭在复制的 node_modules。该外部文件没有首个矩阵样本开始前的哈希。16:08:01 前将其同版本、同字节包复制到隔离 base/node_modules，proto/probes 解析同一冻结副本。新 AB 起止源码、生成和完整依赖目录指纹相等，不能借此倒推原矩阵也全封闭。
3. **初始 DR AB**：S0041–S0064，每场景严格 A/B、B/A、A/B 三对。16:08:14 开始时未先确认 correctness 子进程退出，16:08:24 已确认退出；保守将初始 check 三对 S0041–S0046 全部标为可能重叠，保留不删样。其余场景在这三对之后。S0065–S0066 为原型计数诊断。
4. **独立补充**：S0067–S0072 的 DR check 为预先固定的 A/B、B/A、A/B 三对，16:12:19–16:12:43 UTC；此前确认没有自有 correctness 或已识别的外部 benchmark 子进程。这里的 quiet 仅此含义，不证明宿主完全静默。S0073–S0078 为 IR 短正文三对；S0079–S0084 为 IR 长正文三对（16:13:06–16:13:21）；S0085–S0086 为长正文诊断。后三类具有逐样本 UTC startedAt/finishedAt，whole-second 元数据不代替 monotonic wall。

S0001–S0008 是三条输入的 smoke，不进入正式性能分布。全部 86 次计量行保留，正式为 66 正常 + 12 诊断；无失败/超时/OOM 或删样。另有 12 项 DR CLI 双版本正确性样例、1026 项 IR 身份函数等价样例；它们不进入性能统计。

## 指标口径

- wall：Python monotonic，从 Popen 前到 wait4 返回；包括 Node 启动、模块加载和 CLI 收尾，不含前后 fixture 树哈希和输出整理。
- CPU：wait4 的 user+system，包含该子进程及已等待子进程；worker 属于 Node 线程。RSS：Linux wait4 `ru_maxrss` /1024 为 MiB，是最大进程 RSS，Node worker 线程在同一进程中；不是所有后代同时 RSS 之和，也不是净 JS live heap。
- 函数计数/阶段耗时/阶段末 memory 仅取独立插桩诊断。wrapper 计数保留实际调用和异常语义；`forEachRecordText` 只累计成功回调的实际文本 UTF-8 字节与失败个数，涵盖 worker 返回，不是物理磁盘 I/O 或所有 FS 系统调用。
- 函数计时为 inclusive，异步包括 await，不可相加，不可除正常运行 wall 得出正式瓶颈百分比。hot DR validateDecisionBody 的逐记录 memory 事件不随报告保留，计数和 inclusive 累计完整；删去的事件数量在 profiles 中声明。阶段末 heapUsed 未强制 GC，不是精确可达活对象归因。
- 三次样本报告 min/median/max；配对按原顺序保留。不估计生产 p95、显著性或稳定加速倍数，不跨 matrix/AB 环境计算收益。

## 输出与状态对照

每次读取全部普通 fixture 文件的完整 SHA/size/mode，核对返回后的最终差异：changed 只有索引；check/unchanged/preflight 无最终差异。每对 baseline/prototype，以及矩阵正常/诊断，比较完整 exit、stdout、stderr、index SHA 与最终差异。不是 FS syscall trace、瞬态锁/临时文件审计、inode/mode 竞态或字节相同重写证明，没有独立的产品索引 oracle。

smoke 与矩阵起初复用了两组输出 tag/路径，两个 smoke stdout 路径被后来矩阵覆盖；原样本哈希始终保留，另一份 prototype/source smoke 的同字节输出可按 SHA 恢复，资源流按原 SHA 去重并说明来源。此问题不改变矩阵或 AB 的计量、输入或输出身份。另一次 `/usr/bin/time` 缺失发生在计量启动前；修正后所有实际计量使用 wait4，不丢弃或替换已启动样本。

## 资源保真与生命周期

- `$WORK` 表示本轮唯一隔离实验根，`$REPO` 表示冻结来源根，`$EXTERNAL_OPTIONAL` 表示矩阵实际遇到的外部 optional 依赖根；保留内部相对关系，不固化宿主绝对路径。
- measurements 保留全部计量行，stream 原始 SHA/bytes 与路径替换后的展示 SHA/text 分开。methods 保留形成时完整代码，只替换路径；不是已验证可在报告目录直接执行的长期工具。准备大目录、依赖、每文件地图与大索引不随附，输入总量/聚合指纹和样例生成法保留。
- 报告资源是最终阅读证据；`$WORK` 中辅助 fixture、原型、完整日志与冻结依赖在父代理验收前保留。得到父代理明确通知后，仅清理该精确实验目录；生产文件和其他任务目录不属于清理范围。
