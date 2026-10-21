---
title: "决策与调查工具十万条规模性能调查"
id: "261021-record-tools-100k-performance"
formedAt: "2026-10-21T09:01:29Z"
question: "在10万条有效记录下，主要查询、图操作与维护操作的时间和内存开销在哪里，当前是否存在明显卡点或资源边界？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "relation-graph"
  - "scale-testing"
  - "skill-tooling"
relations:
  - type: "补充"
    target: "261021-decision-investigation-first-batch-performance"
    summary: "扩展到十万条有效记录，区分查询、图与维护成本"
---

## 形成时背景

决策与调查工具已完成第一批常数优化及快照内按需共用图。项目可能每天增加 10–30 份、资料核查密集时约 200 份报告，因此本轮把规模扩到十万条，检查“总体近似线性”是否足以保证交互与维护可用。

本报告补充前序的小规模对照：被测版本、数据规模与图形状均不同，不据此重新计算上一轮优化收益。

## 调查目的

回答三个问题：常用操作在十万条时需要多少时间与内存；成本集中在索引、来源读取、领域校验还是图操作；是否存在硬限、明显超线性路径或返回预算不能约束的开销。保持生产实现与索引格式不变，不引入缓存体系。

## 调查范围与依据

### 固定对象与样本

- 被测源码固定为 Git `5c95358bfd42d8da33d056500c707fc6d5e8069a`，Decision Records 85、Investigation Report 74。
- Node 26.8.2、Linux WSL2/ext4，容器 CPU 配额 4 核、内存上限 6 GiB，宿主启用 swap。环境不是独占硬件，未清空 OS 文件缓存。
- 两域分别创建 10,000／100,000 份真实 Markdown，经真实同步及全量检查建立合法索引。每十条一组、每组九条边，E=0.9N；每条一个 tag、共十种，正文约 1 KiB，短元数据、无资源。决策每组根 archived、九个 active 修订根；调查全部正式可见、叶复查根，另有一个候选。
- 十万条决策索引 69,150,957 字节；调查索引 55,030,362 字节、正式 Markdown 合计 125,790,100 字节。两域载荷、默认页长及命中返回预算不同，适合域内扩展比较，不作同名接口公平排名。
- 另以 1 千／1 万／10 万节点构造合法归并、大入星、长链、拆分，E=N−1，隔离图形状影响。

### 指标、覆盖与复核

正式采集窗口为 2026-10-21 09:14–10:27 UTC。

主矩阵共 62 个操作场景、两个规模，124 组、340 个样本；显式清点操作集合与自适应采样次数。339 次取得预期成功或原生硬限结果，一次决策正文搜索 worker 超时，单独保留。覆盖列表及分页／标签／关系类型筛选、ID／name 读取、trace、metadata 稀有／普遍／零命中、正文搜索、检查、同步、候选读取和分阶段微基准。调查还测关系、更名、发布预检；实际 Git stage 与 CLI 输出另测。补充 75 个图形状、12 个 CLI、12 个 stage 单样本场景后，共 439 次观察；四次 worker 超时（主矩阵一次、stage 三次），其余结果均保留原生状态。

主表是**真实领域服务调用**：决策内部查询 handler、调查公开领域函数；计时包含结果断言，排除进程启动、模块导入与 renderer。原始数据同时保存 fresh-process wall、CPU、heap 前后值及 worker 全生命周期峰值 RSS。微基准的计时外预载也计入该进程 RSS；独立阶段时间不能相加或相减来精确归因。

每项独立进程、测量任务串行；首样本进程 wall 超过 20 秒或失败则只采一次，其余三次。下表 10k 为三次中位数，100k 为中位数及三次范围，单次标 n=1；单位秒，RSS 为该组最大 worker 峰值 MiB。全部场景和完整范围见[统计表](./_resources/261021-record-tools-100k-performance/summary.csv)，CPU 与状态见[完整汇总](./_resources/261021-record-tools-100k-performance/summary.json)。少量样本不支持 p95 或容量 SLA。

方法、预期计数、计时窗口与复现准备见[测量协议](./_resources/261021-record-tools-100k-performance/protocol.md)；形成时脚本用于解释实际做法，不是维护的性能测试套件。源码追链与静态次数见[静态依据](./_resources/261021-record-tools-100k-performance/static-audit.md)。

## 调查结果与边界

### 结论与优先级

1. **已有明显交互成本。** 十万条下，常见索引查询仍需数秒到十余秒；决策全量检查／同步为约两分钟，调查相关操作为二十到五十秒。常见查询 worker 峰值约 700–1,000 MiB，主矩阵维护操作最高约 2,200 MiB。
2. **常规路径的主要排查方向是完整快照的重复准备及来源验证组合。** 常规十万条稀疏图的独立构图仅约 54／96 ms；整索引加载与领域校验约 8.38／3.74 秒。两域独立阶段职责不同，此处只比较量级。
3. **确认一条真正的二次路径。** 调查工具对巨型归并构造关系证据时，数组逐次去重；十万节点的该独立阶段耗约 89 秒。
4. **小结果预算不等于小工作量或小输出。** 关系筛到九个正文候选仍付全集新鲜度成本；trace 最多 50 条记录时，巨型归并仍可生成约 13 MB JSON。
5. **字节数与图形状和条数同样重要。** 本轮无资源、短正文；正文候选数及 Git blob 字节预算都可能先于记录数量成为实际边界。

### 决策：常用操作

| 场景 | 10k 秒 | 100k 秒（范围或 n=1） | 100k RSS MiB |
| --- | ---: | ---: | ---: |
| 默认 list，返回 20 | 0.779 | 14.496（14.272–16.019） | 924 |
| tag list，返回 20 | 0.800 | 7.583（7.489–7.898） | 949 |
| 关系列表，命中 9 | 0.842 | 7.813（7.676–9.759） | 928 |
| show，完整 ID | 0.746 | 7.241（7.022–7.423） | 913 |
| trace，10 条完整切片 | 0.776 | 7.540（7.459–7.797） | 999 |
| metadata，稀有命中 | 1.447 | 15.433（14.642–15.568） | 964 |
| metadata，普遍命中 | 1.567 | 14.237（13.571–14.625） | 917 |
| metadata，零命中 | 1.558 | 13.874（13.151–14.067） | 912 |
| 全量 check | 11.597 | 148.627，n=1 | 2,193 |
| current sync 预检 | 12.771 | 136.408，n=1 | 2,106 |
| 改一条 purpose 后实际 sync 写入 | 18.505 | 123.699，n=1 | 2,192 |
| candidates，实际候选 0 | 3.995 | 76.901，n=1 | 1,183 |

分页、更换 selector 和筛选不会消除整索引准备。默认 list 三次都高于后续若干同类查询；本轮未用 profile 闭合这组差异，保留范围，不将其解释为特定函数退化。正文关系搜索超时是含启动与准备的 worker 观察结果，不是“成功搜索恰需 180 秒”，也未取得该次峰值内存。

### 调查：常用操作

| 场景 | 10k 秒 | 100k 秒（范围或 n=1） | 100k RSS MiB |
| --- | ---: | ---: | ---: |
| 默认 list，返回 10 | 0.999 | 8.955（7.740–9.206） | 846 |
| show，完整 ID | 0.853 | 3.844（3.703–3.925） | 712 |
| trace，10 条完整切片 | 0.475 | 3.841（3.576–3.953） | 744 |
| metadata，稀有命中 | 0.792 | 7.564（7.555–8.216） | 747 |
| metadata，普遍命中 | 0.833 | 8.226（7.988–11.478） | 777 |
| metadata，零命中 | 0.854 | 7.722（7.658–8.449） | 762 |
| check --id，一份报告 | 0.429 | 3.854（3.842–3.887） | 712 |
| 全量 check | 2.151 | 20.844，n=1 | 1,279 |
| current sync 预检 | 3.539 | 31.232，n=1 | 1,586 |
| current sync，无写入 | 3.279 | 29.394，n=1 | 1,596 |
| 改一份正文后实际 sync 写入 | 2.962 | 30.927，n=1 | 1,537 |
| 替换一份报告关系，预检 | 3.388 | 36.561，n=1 | 1,868 |
| 更名一份报告，预检 | 4.687 | 48.884，n=1 | 1,766 |
| 发布一份候选，预检 | 4.527 | 49.046，n=1 | 1,616 |
| candidates，候选 1 | 0.430 | 3.966（3.790–4.037） | 689 |

关系、更名、发布行只证明预检，不代表实际事务写入；sync 两域均真实改来源并写索引。

### 正文搜索：先支付准备成本，再执行候选硬限

| 场景 | 实际候选 | 结果 | 耗时秒 |
| --- | ---: | --- | ---: |
| 决策 100k，无筛选 | 90,000 active | 超过 10,000 候选硬限 | 126.536，n=1 |
| 决策 100k，tag | 9,000 | 返回 20，结果不完整 | 137.906，n=1 |
| 决策 100k，关系筛选 | 9 | worker 超出 180 秒观察窗 | 未取得成功时延，n=1 |
| 调查 10k，无筛选 | 10,000 | 超过 2,000 候选硬限 | 1.684（1.677–1.686） |
| 调查 100k，无筛选 | 100,000 | 同一硬限拒绝 | 15.849（15.683–20.263） |
| 调查 100k，tag | 10,000 | 同一硬限拒绝 | 16.185（15.732–16.917） |
| 调查 100k，关系筛选 | 9 | 返回 9，扫描完整 | 15.520（15.397–17.083） |

作为参照，10k 的决策 tag／关系正文搜索分别为 12.668／12.474 秒，调查关系正文搜索为 1.707 秒，均为三次中位数。

拒绝行保持原生 error，耗时是**拒绝时延**。两域还有限制单文件 2 MiB、请求读取 20 MiB；结果条数 limit 不改变候选数硬限。当前来源新鲜度需要读正式全集，故收紧 tag／关系主要收敛后段匹配，不能消掉前段来源成本。预算错误发生在准备之后，本轮未改变限额或错误优先级。

### 分阶段证据：CPU 与整快照准备值得优先处理

下表单位毫秒；100k 除标 n=1 外为三次中位数。都是独立微基准，不构成可相加的耗时分解。

| 阶段 | 决策 10k／100k | 调查 10k／100k |
| --- | ---: | ---: |
| 索引 readFile／UTF-8 | 16.8／214.3 | 13.7／101.9 |
| 已读文本 JSON.parse | 20.3／365.8 | 19.7／275.4 |
| 完整索引 loader | 827.2／8,384.2 | 391.6／3,739.4 |
| 已加载 list/query 投影 | 29.3／235.5 | 353.3／4,313.9 |
| 来源读取／revision 路径 | 3,347.2／31,412.2，n=1 | 1,132.9／10,737.4 |
| 已读 Markdown 领域解析 | 921.4／9,752.9，n=1 | 116.6／873.3 |
| 新建关系图 | 6.7／54.1 | 9.8／96.0 |
| 已建图完整关系校验 | 16.8／105.3 | 24.3／258.5 |

决策来源阶段含发现、lstat/read、身份解析与 hash；调查来源阶段为 layout 发现与身份解析读取，不是同一 hash 口径。两域 loader 与领域解析职责也不同。决策 check 的进程 CPU 约 135.8 秒、操作 elapsed 148.6 秒；调查 check CPU 22.4 秒、操作 elapsed 20.8 秒。CPU 可因运行时线程累计而超过经过时间；证据不支持把慢操作一概解释为磁盘等待。

源码确认了两类不同性质的全集成本：

- **同一索引的重复准备**：整文件解析后进行 clone/freeze、领域 normalize、完整校验与 canonicalization；若后续 strict query 再准备完整索引，会再次物化／排序。调查已加载 query 阶段仍耗约 4.31 秒；页长只约束末尾切片。决策普通查询还承担领域图校验，但图构建本身不是秒级主项。
- **完整来源验证的多轮职责**：决策健康/current 的 full check 先 scan，再进入 sync(check) 重建比较，末尾还有独立来源漂移守卫。按固定调用链，每份正式来源累计约三次字节读取、五次 YAML 解析（身份三次、完整领域两次）。这是静态调用次数，未以插桩测时间占比；不能把独立快照的图构建或写前复核全部视作可删除重复。

### 图形状：二次去重与大输出

调查 `query-search-selection.ts` 的 `addRelation` 对当前数组执行 `some` 去重。合法纯归并源有 K 个不同 target 时，累计比较 K(K−1)/2；不要求密图，单一高出度就足够触发。

| 节点数／归并边数 | 独立证据构造毫秒 | 返回记录／边证据 |
| --- | ---: | ---: |
| 1,000／999 | 3.96 | 1／999 |
| 10,000／9,999 | 359.35 | 1／9,999 |
| 100,000／99,999 | 89,365.19 | 1／99,999 |

每行 n=1，计时包含证据去重、排序与线性计数断言，不含构图、索引读取或 CLI。这足以确认该有效输入存在二次复杂度卡点，不把 89 秒冒充完整查询耗时。

trace 的记录预算只控制成员接纳。十万节点、maxRecords=50、depth=all 的纯内存切片中：

- 归并：两域都只返回 1 个 entry，却携带 99,999 条直接关系及完整阻断事件，JSON 约 13,000,500 字节。
- 拆分：只返回 1 个 entry，JSON 约 4.4 MB。
- 普通大入星：返回 50 个 entry，frontier 合计保留 99,999 个 next ID，JSON 约 2.2 MB。
- 长链：返回 50 个 entry，JSON 约 14–21 KB；合法十万深链完成校验及切片，没有本次样本的递归爆栈证据。

这些 trace 微操作约 5–310 ms，包含 JSON 序列化；决策投影封装镜像内部查询输出，调查调用 loaded trace，均非完整 CLI。这些输出字节来自现行完整关系、frontier 与事件契约。常规浅图和极端形状的结果见补充原始数据。

### Git stage 与真实 CLI

每个 scope 前把隔离样本的 pending 恢复到本地 HEAD；只改变所选一份来源的 metadata、真实同步，再计时实际 stage。没有连接 remote 或使用项目 hook。每项 n=1：

| stage scope，选择 1 条 | 决策 10k 秒 | 决策 100k | 调查 10k 秒 | 调查 100k 秒 |
| --- | ---: | --- | ---: | ---: |
| index | 16.807 | worker 超过 180 秒观察窗 | 1.392 | 21.110 |
| domain | 13.736 | worker 超过 180 秒观察窗 | 2.201 | 19.749 |
| all | 17.393 | worker 超过 180 秒观察窗 | 2.548 | 26.949 |

完成的九项均实际暂存所选差异：index 一条索引路径、domain 一条 Markdown、all 两条路径。决策 100k 三个 scope 的观察窗含计时外前提读取，未取得 SDK 完成结果；终止后 pending 差异路径均为空，不能将其算作成功暂存。调查 100k stage 的 Node worker 峰值为 1,409–1,672 MiB；Git 子进程内存不在该指标内。

静态链路说明局部写入仍需整索引、关系图、HEAD 与 pending 守卫；决策还有更广的当前／HEAD 来源读取。共享 Git batch 累计 stdout 硬预算为 256 MiB，包含完整 payload 与 framing，即使仅保留所选字节仍累计读取量。本轮未触碰该字节边界，短正文 100k 的结果不能外推到大 pending／资源集合。

真实分发 CLI 另测，n=1，时间为 spawn→close，stdout 通过 pipe 持续读完，记录字节数与 SHA-256，非交互终端渲染：

| 100k CLI | wall 秒 | stdout 字节 |
| --- | ---: | ---: |
| 决策 list | 14.170 | 1,359 |
| 决策 metadata 普遍命中 | 18.307 | 20,521,040 |
| 决策 metadata 稀有命中 | 16.296 | 22,836 |
| 调查 list | 10.103 | 1,065 |
| 调查 metadata 普遍命中 | 8.729 | 10,677 |
| 调查 metadata 稀有命中 | 8.812 | 10,373 |

决策普遍命中返回 90,000 个命中对象，实际输出约 20.5 MB；调查默认只返回最多 50 条，但保留精确命中总计数。CLI 补测断言成功退出、非空输出与 metrics 存在，未逐条验证 renderer。SDK／handler 与 CLI 是不同进程、不同采样，不能用两次耗时相减当作精确 renderer 成本。

### 建议与剩余边界

在保持架构与持久格式不变的前提下，建议下一轮按以下顺序选择小改动并作前后对照；本轮尚未实施或证明收益：

1. **先消除归并证据的二次去重**：以与现有边身份完全一致的局部 Set 管理去重，保留排序、方向、摘要及 filterRelations 结果；覆盖普通星形与纯归并，验证不因边数改变语义。
2. **收敛单次查询内整索引重复 normalize／物化／排序**：让已完成边界校验的快照进入内部查询阶段，优先复用当前调用内的 typed entries、排序和 facets；仍由外部 JSON 边界完整校验，不建立跨调用缓存。
3. **单独设计来源验证复用**：以每一轮实际取得的不可变来源快照为单位复用解析与投影，保留独立漂移守卫、失败语义及错误优先级。先验证决策 scan→sync(check) 组合能否复用，不能直接删掉后一次检查。
4. **优先批量提交领域变化**：同一工作批次集中同步／发布，减少每份报告分别支付全集准备；用真实批量负载补测，而不是用本轮单项时间直接承诺每日吞吐。
5. **将字节与图形状纳入后续预算**：先明确 trace 的成员预算和字节输出不同，并为决策 metadata 广泛命中的输出窗口评估预算，保留完整总计数与覆盖声明；真实出现巨型事件或大资源时，再决定是否需要新的输出／blob 预算契约。当前证据不足以支持先迁移持久图格式。

本轮没有测长正文、大资源树、密图、并发写入、冷缓存、其他平台，或所有领域 mutation 的正式提交／回滚。候选创建和决策生命周期写操作也未单独计时。稀疏样本的近似扩展趋势不能证明一般线性，单次慢项与一次超时也不是稳定尾延迟估计；真实数据的 metadata 字节、最大度、事件成员数和 Git pending 唯一 blob 总量变化时应复查。

本轮只新增报告、派生索引与形成时资源，未修改生产实现。新测量方法的严格类型与格式检查通过，独立复核确认主矩阵统计和全部 75 个图形状结果与原始数据相符；文档按 AI-Ready Docs 收敛计时术语、主结论、重复与边界。领域发布、全量检查及项目检查的实际记录见[验证记录](./_resources/261021-record-tools-100k-performance/verification.json)。

## 随附资源

- [形成时环境输出](./_resources/261021-record-tools-100k-performance/environment.txt)
- [图形状、CLI 与暂存汇总](./_resources/261021-record-tools-100k-performance/extra-summary.json)
- [版本、方法指纹与样本清点](./_resources/261021-record-tools-100k-performance/manifest.json)
- [形成时方法 cli-metrics.ts](./_resources/261021-record-tools-100k-performance/methods/cli-metrics.ts)
- [形成时方法 collector.ts](./_resources/261021-record-tools-100k-performance/methods/collector.ts)
- [形成时方法 decision-stage-worker.ts](./_resources/261021-record-tools-100k-performance/methods/decision-stage-worker.ts)
- [形成时方法 decision-worker.ts](./_resources/261021-record-tools-100k-performance/methods/decision-worker.ts)
- [形成时方法 investigation-worker.ts](./_resources/261021-record-tools-100k-performance/methods/investigation-worker.ts)
- [形成时方法 measurement.ts](./_resources/261021-record-tools-100k-performance/methods/measurement.ts)
- [形成时方法 shape-worker.ts](./_resources/261021-record-tools-100k-performance/methods/shape-worker.ts)
- [形成时方法 stage-collector.ts](./_resources/261021-record-tools-100k-performance/methods/stage-collector.ts)
- [形成时方法 summarize-extra.ts](./_resources/261021-record-tools-100k-performance/methods/summarize-extra.ts)
- [形成时方法 summarize.ts](./_resources/261021-record-tools-100k-performance/methods/summarize.ts)
- [形成时方法 supplement.ts](./_resources/261021-record-tools-100k-performance/methods/supplement.ts)
- [主矩阵原始观察](./_resources/261021-record-tools-100k-performance/observations.jsonl)
- [四个真实集合的建立与验证结果](./_resources/261021-record-tools-100k-performance/preparation.json)
- [测量方法与指标边界](./_resources/261021-record-tools-100k-performance/protocol.md)
- [Git 暂存原始结果](./_resources/261021-record-tools-100k-performance/stage.jsonl)
- [固定源码调用链与复杂度依据](./_resources/261021-record-tools-100k-performance/static-audit.md)
- [完整操作统计表](./_resources/261021-record-tools-100k-performance/summary.csv)
- [完整统计与失败分类](./_resources/261021-record-tools-100k-performance/summary.json)
- [图形状与 CLI 原始结果](./_resources/261021-record-tools-100k-performance/supplement.jsonl)
- [交付验证记录](./_resources/261021-record-tools-100k-performance/verification.json)
