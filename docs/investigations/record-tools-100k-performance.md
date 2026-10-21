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

项目每天可能增加 10–30 份、资料核查密集时约 200 份报告。决策与调查工具已完成第一批常数优化及快照内按需共用图，本轮补充前序调查的规模与图形状覆盖，检查十万条时的交互和维护成本。

## 调查目的

测量常用操作的时间与内存，区分整索引准备、来源验证、图操作和输出成本，识别值得优先处理的卡点。优化候选限定在现有架构与持久格式内，以单次调用内复用为主。

## 调查范围与依据

### 测量条件

- **版本与时间**：源码固定为 Git `5c95358bfd42d8da33d056500c707fc6d5e8069a`，Decision Records 85、Investigation Report 74；采集窗口为 2026-10-21 09:14–10:27 UTC。
- **环境**：Node 26.8.2、Linux WSL2/ext4，容器 CPU 配额 4 核、内存上限 6 GiB，宿主启用 swap；文件缓存沿用运行时状态，硬件由其他任务共享。
- **常规集合**：两域分别建立 1 万／10 万份真实 Markdown，经同步及全量检查生成索引。每十条一组、每组九条边；每条一个 tag、共十种，正文约 1 KiB、短元数据、无资源。决策每组根 archived，其余九条 active 修订根；调查全部正式可见、叶复查根，另有一个候选。
- **字节规模**：十万条决策索引 69,150,957 字节；调查索引 55,030,362 字节、正式 Markdown 合计 125,790,100 字节。两域载荷、默认页长及返回预算不同，扩展趋势按各域自身比较。
- **图形状**：另构造 1 千／1 万／10 万节点的合法归并、大入星、长链和拆分图，每图 N−1 条边，独立测量构图、校验和切片。

### 读数与证据入口

共 **439 次观察**：主矩阵 62 场景×两个规模、340 样本，图形状 75 次、CLI 12 次、Git 暂存 12 次。其中四次 worker 超时，其余取得预期成功或原生候选硬限结果。

- **主表时间**为领域调用的 elapsed：决策内部查询 handler、调查公开领域函数，包含结果断言；启动、导入、CLI 渲染另计。任务串行、每项独立进程；首样本进程 wall 超过 20 秒，或 worker 超时／非零退出时只采一次，其余三次。下表给中位数，单次标“1 次”；完整范围见[操作统计表](./_resources/261021-record-tools-100k-performance/summary.csv)。
- **RSS**为该组 worker 全生命周期峰值的最大值，包含微基准计时外预载；Git 子进程内存另属未覆盖范围。CPU、进程 wall 与失败分类见[完整汇总](./_resources/261021-record-tools-100k-performance/summary.json)。
- **独立微基准**用于比较成本量级，阶段时长不能相加或相减作为精确分摊；CLI、图形状与暂存补测各场景均为单样本。方法见[测量协议](./_resources/261021-record-tools-100k-performance/protocol.md)，调用链与静态次数见[源码依据](./_resources/261021-record-tools-100k-performance/static-audit.md)。

## 调查结果与边界

### 主要结论

1. **十万条已有明显交互成本。** 常见索引查询耗时数秒至十余秒，worker 峰值约 700–1,000 MiB；决策全量检查／同步约两分钟，主矩阵维护操作最高约 2,200 MiB。决策三个暂存 scope 的 worker 均超出 180 秒观察窗。
2. **常规路径的重心是整快照准备与多轮来源验证。** 决策／调查独立构图约 54／96 ms，完整索引加载与校验约 8.38／3.74 秒；构图不是本样本的秒级主项。
3. **高出度归并存在二次去重。** 调查工具为一份报告收集 99,999 条归并边证据时，该独立阶段耗约 89 秒。
4. **记录预算和字节预算需要分别判断。** 九个正文候选仍需全集新鲜度准备；trace 限 50 条记录时，巨型归并仍输出约 13 MB JSON。决策元数据普遍命中的真实 CLI 输出约 20.5 MB。

### 常用操作的时间与内存

两表时间单位为秒，RSS 单位为 MiB。1 万条列均为三次中位数；10 万条除标“1 次”外也为三次中位数。分页、name 选择器、其他筛选和完整波动范围保留在操作统计表中。

#### 决策工具

默认 list 返回 20 条，trace 返回十条完整切片。

| 场景 | 1 万条（秒） | 10 万条（秒） | 10 万条 RSS（MiB） |
| --- | ---: | ---: | ---: |
| 默认 list | 0.779 | 14.496 | 924 |
| show，完整 ID | 0.746 | 7.241 | 913 |
| trace | 0.776 | 7.540 | 999 |
| metadata，稀有命中 | 1.447 | 15.433 | 964 |
| metadata，普遍命中 | 1.567 | 14.237 | 917 |
| metadata，零命中 | 1.558 | 13.874 | 912 |
| 全量 check | 11.597 | 148.627（1 次） | 2,193 |
| current sync 预检 | 12.771 | 136.408（1 次） | 2,106 |
| 改一条 purpose 后实际 sync | 18.505 | 123.699（1 次） | 2,192 |
| candidates，实际候选 0 | 3.995 | 76.901（1 次） | 1,183 |

默认 list 的三次结果为 14.272–16.019 秒，高于后续若干同类查询；差异原因仍待 profile 验证。小分页或精确 ID 查询仍承担整索引准备。

#### 调查工具

默认 list 返回十条，trace 返回十条完整切片。

| 场景 | 1 万条（秒） | 10 万条（秒） | 10 万条 RSS（MiB） |
| --- | ---: | ---: | ---: |
| 默认 list | 0.999 | 8.955 | 846 |
| show，完整 ID | 0.853 | 3.844 | 712 |
| trace | 0.475 | 3.841 | 744 |
| metadata，稀有命中 | 0.792 | 7.564 | 747 |
| metadata，普遍命中 | 0.833 | 8.226 | 777 |
| metadata，零命中 | 0.854 | 7.722 | 762 |
| check --id，一份报告 | 0.429 | 3.854 | 712 |
| 全量 check | 2.151 | 20.844（1 次） | 1,279 |
| current sync，无写入 | 3.279 | 29.394（1 次） | 1,596 |
| 改一份正文后实际 sync | 2.962 | 30.927（1 次） | 1,537 |
| 替换一份报告关系，预检 | 3.388 | 36.561（1 次） | 1,868 |
| 更名一份报告，预检 | 4.687 | 48.884（1 次） | 1,766 |
| 发布一份候选，预检 | 4.527 | 49.046（1 次） | 1,616 |
| candidates，候选 1 | 0.430 | 3.966 | 689 |

两域 sync 写入行都实际改变来源并写入索引；调查关系、更名和发布行只测预检。

### 正文搜索：候选减少后仍有全集准备

| 10 万条场景 | 实际候选 | 结果 | 秒 |
| --- | ---: | --- | ---: |
| 决策，无筛选 | 90,000 active | 候选硬限拒绝 | 126.536（1 次） |
| 决策，tag | 9,000 | 返回 20，结果不完整 | 137.906（1 次） |
| 决策，关系筛选 | 9 | worker 超时 | — |
| 调查，无筛选 | 100,000 | 候选硬限拒绝 | 15.849 |
| 调查，tag | 10,000 | 候选硬限拒绝 | 16.185 |
| 调查，关系筛选 | 9 | 返回 9，扫描完整 | 15.520 |

1 万条时，决策 tag／关系正文搜索为 12.668／12.474 秒，调查关系正文搜索为 1.707 秒。调查无筛选搜索在 1 万条已触发候选硬限，拒绝时延为 1.684 秒。

候选硬限为决策 10,000、调查 2,000 个文件，另有单文件 2 MiB、请求读取 20 MiB 预算。拒绝行是原生 error，所列时间仅表示拒绝时延。决策关系搜索的单次 worker 在 180 秒观察窗内未完成，未取得调用时长与峰值内存。

来源新鲜度准备读取正式全集，候选筛选随后才收敛匹配范围。因此，收紧 tag／关系和返回条数主要减少后段工作；候选硬限也发生在前置准备之后。

### 成本定位：索引准备与来源验证

下表只列十万条独立微基准，单位毫秒；除标“1 次”外为三次中位数。

| 阶段 | 决策（ms） | 调查（ms） |
| --- | ---: | ---: |
| 索引 readFile／UTF-8 | 214.3 | 101.9 |
| 已读文本 JSON.parse | 365.8 | 275.4 |
| 完整索引 loader | 8,384.2 | 3,739.4 |
| 已加载 list/query 投影 | 235.5 | 4,313.9 |
| 来源读取／revision 路径 | 31,412.2（1 次） | 10,737.4 |
| 已读 Markdown 领域解析 | 9,752.9（1 次） | 873.3 |
| 新建关系图 | 54.1 | 96.0 |
| 已建图完整关系校验 | 105.3 | 258.5 |

决策来源阶段含发现、lstat/read、身份解析与 hash；调查来源阶段为 layout 发现、身份解析和读取。两域 loader、领域解析的职责也各不相同。

静态调用链与微基准共同指向两个优化对象：

- **同一索引的重复准备**：加载后逐条复制／冻结、规范化、校验和排序；后续 strict query 可能再次物化和准备全集。调查已加载 query 阶段仍耗约 4.31 秒，分页发生在这些步骤之后。
- **多轮来源验证**：决策健康/current 的 full check 先 scan，再进入 sync(check) 重建比较，末尾独立复核来源漂移；每份正式来源累计约三次字节读取、五次 YAML 解析（身份三次、完整领域两次）。这是静态调用次数，复用应按各阶段的验证责任划界。

决策 check 的进程 CPU 约 135.8 秒、调用 elapsed 148.6 秒；调查分别为 22.4／20.8 秒。运行时线程会累计 CPU，慢操作同时包含计算与文件访问，具体时间占比仍待 profile 验证。

### 图形状：归并去重和切片输出

调查 `tools/investigation-report/src/query-search-selection.ts` 的 `addRelation` 逐次用数组 `some` 检查已有证据。一个合法归并源拥有 K 个互异 target 时，累计比较 K(K−1)/2；单一高出度即可触发。

| 节点／归并边 | 独立证据构造毫秒 | 返回记录／边证据 |
| --- | ---: | ---: |
| 1,000／999 | 3.96 | 1／999 |
| 10,000／9,999 | 359.35 | 1／9,999 |
| 100,000／99,999 | 89,365.19 | 1／99,999 |

每行单样本，计时包含去重、排序和线性计数断言，构图在计时前完成。这是证据构造阶段的二次卡点，完整查询还承担索引准备等成本。

十万节点、`maxRecords=50`、`depth=all` 的 trace 结果还显示：

| 图形状 | 返回 entry | JSON 大小 |
| --- | ---: | ---: |
| 归并 | 1 | 约 13 MB |
| 拆分 | 1 | 约 4.4 MB |
| 大入星 | 50 | 约 2.2 MB |
| 长链 | 50 | 约 14–21 KB |

归并 entry 保留 99,999 条直接关系及完整阻断事件；大入星的 frontier 保留 99,999 个 next ID。成员预算因此只约束记录接纳，完整关系与事件字段仍随图形状增长。上述纯内存 trace 含投影和 JSON 序列化，耗时约 5–310 ms；两域十万深链均完成图校验及有界切片。详细结果见[补充汇总](./_resources/261021-record-tools-100k-performance/extra-summary.json)。

### Git 暂存与 CLI 输出

暂存只选择一条正式记录：先建立隔离 Git HEAD，改变所选来源 metadata 并同步；每个 scope 前恢复该样本 pending 到 HEAD，再计时实际 stage。每项单样本。

| scope | 决策 1 万条（秒） | 决策 10 万条 | 调查 1 万条（秒） | 调查 10 万条（秒） |
| --- | ---: | --- | ---: | ---: |
| index | 16.807 | 超时 | 1.392 | 21.110 |
| domain | 13.736 | 超时 | 2.201 | 19.749 |
| all | 17.393 | 超时 | 2.548 | 26.949 |

成功的九项都实际暂存了所选差异：index 一条索引路径、domain 一条 Markdown、all 两条路径。决策三个超时均为含前提读取的 180 秒 worker 观察窗，未取得调用返回；终止后 pending 差异路径均为空。调查十万条 stage 的 Node worker 峰值为 1,409–1,672 MiB。

局部写入仍需整索引、关系图、HEAD 与 pending 守卫，决策另有更广的来源读取。共享 Git batch 的累计 stdout 硬预算为 256 MiB，计算完整 payload 与 framing；本轮只确认该静态预算，未测试其字节边界。

真实分发 CLI 另以 pipe 持续读取 stdout，时间为进程启动到退出的 wall，每项单样本：

| 10 万条 CLI | wall 秒 | stdout 字节 |
| --- | ---: | ---: |
| 决策 list | 14.170 | 1,359 |
| 决策 metadata 普遍命中 | 18.307 | 20,521,040 |
| 调查 list | 10.103 | 1,065 |
| 调查 metadata 普遍命中 | 8.729 | 10,677 |

决策普遍命中返回 90,000 个对象，调查默认最多返回 50 条并保留精确总计数。CLI 证据覆盖成功退出、输出字节和指纹；逐条渲染正确性及交互终端成本另属未覆盖范围。

### 推荐方案与验证边界

以下是基于本轮证据的候选方案，收益需以后续前后对照确认：

1. **先改归并证据去重**：用调用内 Set／Map 按现有 sourceId、type、target 三元组去重，保留现有证据、摘要选择和排序。用普通星形及高出度归并验证结果一致性与增长趋势。
2. **复用已验证的查询快照**：内部查询消费当前调用已完成校验的 entries／投影视图，收敛重复规范化、物化、facets 与排序；原始 JSON 入口继续完整校验。
3. **再收敛来源验证组合**：重点验证决策 scan→sync(check) 能否复用同一来源快照的解析与投影，保留后续独立漂移守卫、错误优先级和失败语义。
4. **按批次同步／发布**：一批来源编辑集中支付全集准备；实际收益以真实批量负载补测。
5. **分别设计返回窗口与字节预算**：决策 metadata 可评估返回 limit，保留精确总数和覆盖声明；巨型 trace／资源的预算调整另按完整关系与事件契约评估。

本轮保持生产实现不变，测量代码与原始结果作为形成时材料保留。适用边界是所列版本、短正文、无资源及已测图形状；长正文、大资源、密图、并发写入、冷缓存、其他平台、候选创建和未列正式 mutation／回滚仍待验证。少量样本反映本次量级与卡点，不构成 p95、每日吞吐或一般线性扩展承诺。形成时验证与复核结果见[验证记录](./_resources/261021-record-tools-100k-performance/verification.json)。

## 随附资源

- [形成时环境输出](./_resources/261021-record-tools-100k-performance/environment.txt)
- [图形状、CLI 与暂存汇总](./_resources/261021-record-tools-100k-performance/extra-summary.json)
- [版本、方法指纹与样本清点](./_resources/261021-record-tools-100k-performance/manifest.json)
- [CLI 进程指标采集方法](./_resources/261021-record-tools-100k-performance/methods/cli-metrics.ts)
- [主矩阵采集方法](./_resources/261021-record-tools-100k-performance/methods/collector.ts)
- [决策暂存测量方法](./_resources/261021-record-tools-100k-performance/methods/decision-stage-worker.ts)
- [决策样本与操作测量方法](./_resources/261021-record-tools-100k-performance/methods/decision-worker.ts)
- [调查样本与操作测量方法](./_resources/261021-record-tools-100k-performance/methods/investigation-worker.ts)
- [通用计时与指标定义](./_resources/261021-record-tools-100k-performance/methods/measurement.ts)
- [图形状构造与测量方法](./_resources/261021-record-tools-100k-performance/methods/shape-worker.ts)
- [隔离 Git 基线与暂存采集方法](./_resources/261021-record-tools-100k-performance/methods/stage-collector.ts)
- [图形状、CLI 与暂存汇总方法](./_resources/261021-record-tools-100k-performance/methods/summarize-extra.ts)
- [主矩阵清点与统计方法](./_resources/261021-record-tools-100k-performance/methods/summarize.ts)
- [图形状与 CLI 采集方法](./_resources/261021-record-tools-100k-performance/methods/supplement.ts)
- [主矩阵原始观察](./_resources/261021-record-tools-100k-performance/observations.jsonl)
- [四个真实集合的建立与验证结果](./_resources/261021-record-tools-100k-performance/preparation.json)
- [测量方法与指标边界](./_resources/261021-record-tools-100k-performance/protocol.md)
- [Git 暂存原始结果](./_resources/261021-record-tools-100k-performance/stage.jsonl)
- [固定源码调用链与复杂度依据](./_resources/261021-record-tools-100k-performance/static-audit.md)
- [完整操作统计表](./_resources/261021-record-tools-100k-performance/summary.csv)
- [完整统计与失败分类](./_resources/261021-record-tools-100k-performance/summary.json)
- [图形状与 CLI 原始结果](./_resources/261021-record-tools-100k-performance/supplement.jsonl)
- [交付验证记录](./_resources/261021-record-tools-100k-performance/verification.json)
