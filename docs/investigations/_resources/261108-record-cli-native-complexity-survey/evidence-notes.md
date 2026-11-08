# 证据说明与资源导航

本文件解释 2026-11-08 原生 CLI 普查的采集方法、观察和计量边界。报告正文承接成本地图、两项新发现及建议；这里供检查具体依据时按需阅读。本次文档整理沿用该轮材料，没有新增性能样本。

## 按问题选择资源

| 复核任务 | 先读 | 继续核对 |
| --- | --- | --- |
| 某入口实际查过什么 | [入口地图](./inventory/coverage.md) | [逐入口矩阵](./inventory/coverage.json) 给出源码路径、数据文件、选择器及未测项。 |
| 查询、候选发现与预算 | [查询说明](./queries/coverage.md) | `queries/samples.jsonl` 按 `scenario`、`domain`、`rep` 定位；环境与守卫各有 JSON。 |
| 关系图、事件与资源 owner | [图说明](./graphs/coverage.md) | `trace_results.jsonl`、`ordinary-results.json`、`realloc-*-results.json`、`resource-*-results.json`；断言见对应脚本。 |
| 写入、历史、stage 与未选保护 | [写入与 Git 说明](./writes/coverage.md) | `wide.jsonl` 为入口代表，`scale.jsonl` 为 K 探针，`history-edges.jsonl` 为共享目标，`pending-scale.jsonl` 为 P 探针，`unselected-audit.jsonl` 为完整成员对账。 |
| Git 子进程计数 | `writes/*trace.jsonl` | 历史对照为 `history-before/after.trace.jsonl`；stage 为 `d/i-stage-k8.trace.jsonl`。这些调用与无插桩计时分开。 |

原始样本 JSON/JSONL、Trace2 和脚本保持采集时内容；覆盖矩阵及说明按已取得的证据整理为完成态。脚本保存当时的动作、断言和接续方式，路径及 fixture 状态属于历史现场；按现目录直接重跑可能追加数据、拒绝既有目录或改变私有 Git 状态。它们是阅读证据，执行及其他副作用须另行授权。未随报告复制大 fixture、Git 仓库或二进制。

## 版本、环境与输入

| 项目 | 形成时身份 |
| --- | --- |
| 主仓库源码 | `c1161cf1db52cf2de9ba5e0829808e18ebdccf19` |
| 候选版本 | 两域原生 release 0.1.0，x86_64 Linux，protocol v2 |
| manifest 源码树 SHA-256 | `88c5ecaa22b7a42ba660b7c14a3e0c5300c85fb4174c5fc818792b25d976c072` |
| DR 二进制 SHA-256 | `42bdfe5113c4a6ffa404efa54eb68f42a42003a92f51e3529b5ddd5ef8fe2a6b` |
| IR 二进制 SHA-256 | `1e1aa4a14553239e2cbe22723d738ee53b3dc46b53ba9a355add3825c453ab20` |
| 环境 | Linux 6.18.33.2 WSL2、ext4、AMD Ryzen AI 7 H 450；枚举 6 逻辑 CPU、可用 4，Git 2.53.0 |

复用资产位于当时的 `/workspace/skills/dist/record-cli-perf-261107-main/`。汇总复核将 manifest 列出的 316 个源码文件与工作树逐字节比较，并核对二进制 hash；这是列举文件与资产的身份依据，不是重新构建证明，也不覆盖未列文件或窗口内每一时刻。

查询复用前轮生成的短文本、低图密度只读 fixture；它们此前经生产 CLI sync/check。本轮复核生成逻辑、选中正文和输出，未对这些复用来源重跑全集健康检查。写入及新建图探针采用独立私有 Git 仓库；真实生产记录与主仓库 pending 不参与原生试验。私有现场保留于 `/workspace/skills/dist/record-native-survey-20261108/`，不是正式资源的执行依赖。

## 调查如何展开

1. 从两个候选的顶层及命令帮助、协议和源码枚举入口，恢复索引、来源、图、资源、事务与 Git 阶段。
2. 运行合法正常代表及有判断价值的边界：命中/未命中、页面/空页、ID/name、候选/正式、关系事件、full/selected 和各 stage scope；按独立期望核对输出或状态。
3. 解释正常成本：全量 facets、精确计数、完整图与组合索引、身份/历史及 pending 保护均有实际责任。
4. 再由观察和源码放大少量维度。历史检查逐边读取引出共享目标探针；资源 owner 的 `contains` 引出合法资源阶梯；stage 的静态 membership 扫描引出 P 对照，结果保留为未显示显著恶化的反例。
5. 按 32 个域别入口逐项结算源码、代表、证据与未测项。覆盖达到本轮入口普查范围，分支、异常和优化收益继续保持明确边界。

## 采样、档位与计量

| 切面 | 实际档位与重复 |
| --- | --- |
| 查询 | N=32/250/1200 每臂 3 次，N=5000 每臂 1 次；候选 C=1/32/250 及其他分支通常 3 次，参数位置单次。 |
| 图 | 小例通常 3 次，较大图通常 1 次；DR 稀疏重划 k=3/50/250 各一次。IR 资源 R=0/30/500/2000，R=2000 查询另有两次逐文件守卫复测。 |
| 写入与 Git | 广覆盖和实际 stage K=1/8/32 大多单次；历史对照每组 2 次；DR no-op stage P=503/1003/2003 每组 3 次。 |

档位围绕实际工作量选择，而非统一套用十倍阶梯。查询中 N=5000 已提供较大规模与预算边界观察；候选 C=250 可与集合发现路径对应；资源档位扩大源码比较量；历史探针固定 N 和唯一目标数，专门改变共享目标的边数。高成本样本少测，保留原始值；这些样本支持机制定位与数量级判断，不用于拟合全 CLI 复杂度指数或尾延迟。

wall 从新进程启动至 stdout/stderr 收集及退出，fixture 准备、写后验证不计入。缓存未清理、整机未严格隔离。查询无预热和随机化，缺逐样本绝对时间；完成文件 mtime 为 2026-11-08 06:25:30 UTC。图采集窗口为同日 06:26–06:29 UTC。采集工作按切面顺序协调，仍可能受系统竞争影响。

三类证据分别解释：源码计数是指定输入上的逻辑工作；Trace2 是另一次插桩调用的 Git start 计数；wall 包含启动、解析、领域工作和输出。完整图与无图查询的差值、no-op 计数与实写时间，均没有被当作隔离阶段成本。少量样本未计算 P95，本轮未采 CPU/RSS 或严格冷缓存数据。

## 正常观察与放大探针

### 查询的首样差异

N=1200 content 无命中完整调用，DR 三次为 233.73/32.42/32.21 ms，IR 为 209.95/24.85/24.38 ms。首样与重复值差异明显，但没有缓存或 I/O 阶段测量来确定原因。两域成功调用的 limit 和输出不同，跨域绝对值不作性能排名。

IR N=5000 content 在扫描前触发 2000 候选文件预算拒绝；其时间归入拒绝路径，成功扫描覆盖至 N=1200。具体 `coverage` 和预览断言见查询说明与样本。

### 历史目标、资源与 stage

- **历史目标**：`tools/record-cli/src/mutations/check/history.rs` 逐关系取得固定 HEAD 的目标事实；`git/revision.rs`、`git.rs::read_blob` 分别调用 tree、blob、hash 校验。探针 N=250、E=30→62、唯一历史目标恒 22；目标 `260101-record-00026` 出现 8→40 次。私有仓库独立对账恰有 32 个正文及索引变化，目标正文保持；无插桩 check 每组两次，独立 Trace2 各一次。正文给出的 98→194 start 及三类调用各 +32 与此对应。
- **资源 owner**：`tools/record-cli/src/domains/investigation/graph.rs` 的 `Vec.contains` 对每条引用顺序查找。单 owner 的 R 个唯一自有资源构成 1…R 次成功元素比较，合计 `R(R+1)/2`；这是元素相等比较次数，不是字符比较次数或 CPU 指令数。R=2000 的 sync/check 各一次约 1.76/1.84 s，包含真实文件来源工作；短 trace 的 wall 另计。
- **实际 stage 的 K**：N=250、初始 P=503，all scope 的 K=1/8/32 各一次，DR 为 119.104/214.895/507.320 ms，IR 为 138.722/284.094/866.885 ms。输入对象、累积状态、写入和输出同时变化，故只是完整工作量观察。另一次 K=8 no-op Trace2 的 DR/IR start 为 41/87，不能代替这些实写调用的进程数。
- **P 对照与保护**：P 表示 Git index 全成员数，不是已修改条目数。三档 P 计时仅 DR index-only K=1 no-op；两域 P=2003 的实际 all stage 则各完整比较前后 membership，恰有选中来源与索引两项变化，2001 个未选成员保持。

## 断言、纠错与守卫范围

| 切面 | 可确认内容与保留边界 |
| --- | --- |
| 查询 | 290 次观察中 284 次符合独立 oracle，含预期拒绝；6 次 `list-tag-date` 是调查脚本传 date-only 的错误，改为 RFC3339 后各域三次通过。完整 stdout/stderr、exit、hash 和 oracle 均保存。断言覆盖选定 ID、计数、正文、分页或预览，并非全字段协议差分。资产和索引有守卫，全部正文没有逐文件守卫。 |
| 图 | 50 次双域 trace 样本的独立期望通过，另有普通宽边、重划及资源探针。成功数据主要保存 argv、exit、长度/hash、耗时与运行时断言结果，完整成功 stdout 未归档。R=2000 复测守卫 2005 项；其余范围见图说明。 |
| 写入 | `wide.jsonl` 为 95 条记录：88 次 CLI 调用、7 条独立状态断言；11 条有准备或预期错误，原样保留并接续纠正。完整文件差异、selected 内容及未选 pending 对账按具体记录解释。 |

写入脚本纠错包括 DR tag/title 不合法、pending 门禁先于历史门禁、同 ID 不同 sourcePath 被误认作 no-op、IR 候选无 `.md` 导致 glob 失败，以及历史脚本误将 fixture.json 的未跟踪状态视为意外 dirty。补测从实际状态接续；这些是方法记录，不归为产品缺陷或通过样本。详见写入说明与 `*-continue*.py`。

未覆盖分支按入口矩阵检索：复杂 evolve、IR 多候选/资源 publish、正式 owner 资源更名/删除、已记录删除确认、selected 索引回退，以及 Git unborn、缺失历史索引、冲突、外部资源、故障与竞争等。合法 fixture 及机械领域检查证明可达性和所断言结果，不代替全部业务语义审阅或候选发布验收。

## 附带接口观察

两域 `--root ROOT --json list` 均退出 2，诊断为 `unsupported query command: --json`；`--root ROOT list --json` 可用。顶层 help 将 `--json` 列为 Global options，而实际前置位置解析只识别 root/领域目录等选项。这是帮助措辞与参数位置的一致性线索，尚不足以仅凭“Global”认定所有排列均属承诺，也不属于算法复杂度结论。
