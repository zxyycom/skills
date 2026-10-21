---
title: "记录工具当前版本十万条存量全操作性能调查"
id: "261021-record-tools-all-operations-100k"
formedAt: "2026-10-21T17:07:37Z"
question: "当前版本在十万条存量、单对象简单操作下，全部业务命令的真实 CLI 成本与容量边界是什么？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "scale-testing"
relations:
  - type: "补充"
    target: "261021-record-tools-first-optimization-validation"
    summary: "补齐当前版全业务命令与实际写入的十万条成本"
---

## 形成时背景

前序[首轮优化验证](record-tools-first-optimization-validation.md)选择少量操作做前后对照，没有覆盖当前版本的全部业务入口及实际写入。本轮按用户明确的场景补齐：**存量十万条，每次操作简单且有限**。查询只展开小窗口，维护只选择单条记录及少量关系或资源，操作量本身不随存量增长。

本轮固定 Git `94f792e09efa39700005ace7e05be2bc14fb9579`，Decision Records 86、Investigation Report 75。使用真实公开 CLI 和 Node 默认 heap，与前序 SDK／4 GiB 测量分别保留；两轮计时边界与载荷不同，不直接计算加速率。

## 调查目的

覆盖 Decision 全部 18 个、Investigation 全部 14 个业务命令，测出十万条存量下的单次完整命令成本与容量边界；区分发布快照查询、当前来源验证、实际维护写入和 Git 暂存。完整覆盖业务入口，不等于穷举参数组合、异常组合或大批量变更。本轮只调查，不修改生产实现、持久格式或缓存架构。

## 调查范围与依据

### 数据与操作单位

每域为独立合成 Git 仓库及固定 HEAD，基线包含 **100,000 份正式 Markdown、2 份 ready 候选、90,000 条关系**。每十条一组、九条叶到根边，无跨组边。每条命令前恢复基线并准备常数份来源变化；发布／删除后的瞬时正式数允许 N±1，下一场景恢复 N。

| 数据条件 | Decision | Investigation |
| --- | --- | --- |
| 生命周期 | 89,999 active、10,001 archived；1 条 unaligned | 全部正式 |
| 正式 Markdown | 合计 113,440,052 字节；单份 1,048–1,192 字节 | 每份 1,024 字节 |
| 基线索引 | 77,900,293 字节 | 64,760,458 字节 |
| 资源 | 无独立资源池 | 固定 5 个、各 96 字节；数量不随 N 增长 |
| 关系操作 | 单边／小组查询或替换单边摘要 | 单边／十节点小组查询或替换单边摘要 |

资源样本覆盖读取、发布、改名、删除及暂存路径；stage 只选一个 owner，修改一个已有资源并新增一个小资源，同时保护未选 owner 和域外 pending。它不是十万份附件的容量测试。

必要变体共 **47 个场景**：metadata 少命中；默认 content 原生硬限与关系小集合成功；同步预演、实际单改、无改及 selected；三种 stage scope。其余命令选择一个简单、可完成实际效果核对的路径。`help` 不读取集合，只保存公开命令清单，不作规模计时。精确 argv、输入和预期变化见覆盖清单。

### 计量与核对

- **采集窗口**：2026-10-21 15:16–17:06 UTC；正式 CLI 串行，每场景一次。wall 包含启动、模块加载、业务处理、渲染至退出；不含 fixture 准备与后验核对。辅助阶段时长另存原始记录。
- **环境**：Node 26.8.2、Bun 1.4.2、Python 3.14.7、WSL2 Linux，4 CPU 配额、6 GiB 容器内存。CLI 无 heap 参数，`NODE_OPTIONS` 未设置，Node 默认 heap limit 为 2,248,146,944 字节。准备／核对辅助进程单独使用 4 GiB heap，不传给 CLI。
- **指标**：`os.wait4(CLI)` 记录 wall、user/system CPU 与 maxrss；表中 CPU 为 user＋system，RSS 不是同时刻进程树内存总和，也不等于 JS heap。完整 stdout/stderr 落盘并计算 SHA-256，不依赖终端截断内容。没有主动清 OS 缓存，不是冷缓存测量。
- **限时与隔离**：业务命令 600 秒，准备／核对各 1,800 秒，分别计限。异常立即停止该域，保存现场、核对进程退出与精确残留，再人工恢复自有合成基线，继续未尝试命令。
- **实际效果**：成功／预期拒绝还须通过独立后验，核对完整预期索引字节、来源生命周期、候选／资源、完整工作树差异及相应 pending 保护。发布、删除、改名和暂存均实际执行；同步预检另列，不代替写入样本。

## 调查结果与边界

### 主要结论

1. **32 个业务命令、47 个场景全部尝试并取得指标**：40 个正常成功、2 个精确原生搜索预算拒绝、5 个 Node heap OOM。无未测命令，无 600 秒超时。成功及预算拒绝均通过独立后验；OOM 不计成功。
2. **小输入仍承担显著存量成本**：索引型 list／show／trace 本次约 4–7 秒，metadata 少命中约 11 秒；创建一个候选也需 Decision 109 秒、Investigation 80 秒。返回量小不等于全集准备少。
3. **实际写入比预检更需单列**：Decision 单条归档 471.651 秒、删除 430.098 秒、重新启用 441.758 秒；三种 stage 为 163–193 秒。Investigation 发布一个候选 160.448 秒，三种 stage 为 15–26 秒。各域载荷与契约不同，不据此归因为某一个内部阶段。
4. **默认 heap 已出现容量边界，且与写入状态有关**：Decision rename／publish／evolve／set-relations，以及 Investigation rename 均异常终止。五处事后对账时预期来源与完整索引字节已落地，但 CLI 无正常成功返回且集合锁残留；不能把失败理解为“什么都没发生”。

### Decision：25 场景覆盖 18 个命令

以下均为单次完整 CLI 读数，不是中位数。行按操作组织；实际采样顺序见原始观测。

| 命令与输入 | wall（秒） | CPU（秒） | RSS（MiB） | 结果 |
| --- | ---: | ---: | ---: | --- |
| `check`：全量正式集与 2 候选 | 99.951 | 91.199 | 1736.8 | 成功 |
| `candidates`：列出 2 候选 | 37.740 | 40.742 | 1135.4 | 成功 |
| `list --limit 1`：返回 1 条 | 5.572 | 6.994 | 875.0 | 成功 |
| `search --in metadata`：默认窗口，1 命中 | 11.679 | 13.283 | 881.8 | 成功 |
| `search`：默认 content，89,999 候选文件 | 120.565 | 126.047 | 1553.8 | 预算拒绝 |
| `search --related-to`：8 文件，1 命中 | 127.873 | 132.566 | 1556.5 | 成功 |
| `show`：1 正式正文 | 5.216 | 6.334 | 816.2 | 成功 |
| `show-candidate`：1 候选 | 34.165 | 37.013 | 1200.7 | 成功 |
| `trace`：2 节点、1 边 | 6.694 | 8.375 | 891.3 | 成功 |
| `sync-index --preflight`：手改 1 正文 | 115.598 | 123.031 | 1701.1 | 成功 |
| `sync-index`：实际接纳 1 正文 | 120.030 | 128.024 | 1925.3 | 成功 |
| `sync-index`：current，无变化 | 117.329 | 125.592 | 1752.5 | 成功 |
| `sync-index --select`：只选 1 变化 ID | 127.145 | 138.733 | 2024.9 | 成功 |
| `new`：创建 1 scaffold | 109.078 | 116.351 | 1642.6 | 成功 |
| `rename`：1 条已记录叶节点 | 428.417 | 521.238 | 2694.2 | heap OOM |
| `stage --scope index`：1 条投影 | 177.687 | 191.595 | 1952.1 | 成功 |
| `stage --scope domain`：1 正文 | 163.068 | 185.834 | 1760.6 | 成功 |
| `stage --scope all`：1 正文及投影 | 193.110 | 219.102 | 2100.2 | 成功 |
| `publish`：1 候选，归档 1 前序 | 384.217 | 468.570 | 2678.5 | heap OOM |
| `reactivate`：1 archived | 441.758 | 480.834 | 2532.0 | 成功 |
| `evolve`：1 候选，归档 1 前序 | 413.555 | 485.211 | 2699.1 | heap OOM |
| `set-relations`：改 1 边摘要 | 339.338 | 424.570 | 2596.0 | heap OOM |
| `mark-aligned`：1 条 unaligned | 425.434 | 475.788 | 2575.2 | 成功 |
| `archive`：归档 1 条 | 471.651 | 531.070 | 2742.9 | 成功 |
| `discard`：删除 1 条已记录叶节点 | 430.098 | 481.866 | 2671.6 | 成功 |

### Investigation：22 场景覆盖 14 个命令

| 命令与输入 | wall（秒） | CPU（秒） | RSS（MiB） | 结果 |
| --- | ---: | ---: | ---: | --- |
| `new`：创建 1 scaffold | 79.523 | 67.355 | 1601.5 | 成功 |
| `candidates`：列出 2 候选 | 4.410 | 5.275 | 695.0 | 成功 |
| `show-candidate`：1 候选及小资源 | 4.261 | 5.231 | 680.0 | 成功 |
| `publish`：实际发布 1 候选及 1 边 | 160.448 | 167.097 | 2123.8 | 成功 |
| `rename`：1 叶节点及 1 owner 资源 | 177.322 | 196.668 | 2444.8 | heap OOM |
| `check --id`：1 报告及 1 资源 | 4.297 | 5.169 | 730.4 | 成功 |
| `check`：全量正式集、关系、资源、索引 | 58.290 | 61.478 | 1349.1 | 成功 |
| `sync-index --preflight`：手改 1 正文 | 30.952 | 31.797 | 1637.1 | 成功 |
| `sync-index`：实际接纳 1 正文 | 31.064 | 32.601 | 1663.2 | 成功 |
| `sync-index`：current，无变化 | 30.825 | 31.667 | 1624.8 | 成功 |
| `sync-index --select`：只选 1 变化 ID | 40.288 | 43.618 | 1636.5 | 成功 |
| `list`：默认返回 10 条 | 5.224 | 6.228 | 785.7 | 成功 |
| `search --in metadata`：默认窗口，1 命中 | 10.681 | 11.592 | 735.1 | 成功 |
| `search`：默认 content，100,000 候选文件 | 16.378 | 17.233 | 868.8 | 预算拒绝 |
| `search --related-to`：9 文件，9 命中 | 16.327 | 17.110 | 875.5 | 成功 |
| `show`：1 正文 | 4.154 | 4.995 | 734.7 | 成功 |
| `trace`：10 节点小组 | 4.269 | 5.149 | 742.1 | 成功 |
| `set-relations`：改 1 边摘要 | 70.014 | 70.567 | 1958.4 | 成功 |
| `stage --scope index`：1 条投影 | 15.087 | 19.201 | 1401.9 | 成功 |
| `stage --scope domain`：1 报告及小资源树 | 21.424 | 29.659 | 1757.2 | 成功 |
| `stage --scope all`：1 报告、资源树及投影 | 25.922 | 35.590 | 1936.2 | 成功 |
| `discard`：1 已记录叶节点及自有资源 | 88.579 | 90.495 | 1935.2 | 成功 |

### 预算拒绝与写后崩溃

默认 content 在匹配前触及候选文件硬限：Decision 10,000、Investigation 2,000。两条拒绝耗时分别为 120.565 和 16.378 秒，**不是扫描十万份正文并成功返回**。拒绝前仍进行全集来源验证；关系筛选只有 8／9 个匹配候选，也不意味着前置只读这些文件。当前 metadata 默认窗口分别为 Decision 100、Investigation 50，本轮两域都只有一个命中，不测大量命中或无界输出。

五处 OOM 都有 V8 fatal heap 诊断及 `SIGABRT`，不是超时；对应 `memory.events` 的 oom、oom_kill、oom_group_kill 增量均为 0，未观察到 cgroup OOM-kill。max 事件增加只说明触及内存上限事件，不能单独解释为 OS 杀进程。RSS 与 heap 范围不同，成功的高 RSS 样本也不能消除 heap 边界。

失败现场保留完整索引的预期 delta 摘要、来源／资源字节、Git 差异和空锁信息；随后仅在确认进程退出后清理精确的自有 fixture 锁，再由受 guard 保护的准备阶段恢复 HEAD 与已知新增路径。后续场景重新核对基线后才运行。这是**调查现场的人工恢复**，不表示崩溃命令自行回滚，也不补写它未返回的 mutation outcome。

### 优化优先级：保持架构，先减少重复准备和活跃副本

以下为实测支持的优先级与静态候选，不是本轮已经实现或测出收益的改进。调用位置与依据见静态审查资源。

| 优先级 | 卡点与证据 | 推荐的下一步 |
| --- | --- | --- |
| 1 | 五处默认 heap OOM；Decision 若干单条事务超过 7 分钟 | 先调查事务峰值：将 rollback 数据收敛为旧索引和真正变更的来源，缩短全集旧解析图、锁外预演与新快照重叠存活。保留写前漂移及恢复义务；先取 allocation／heap profile，闭合根因。 |
| 2 | Decision 写入事务仍有多轮全集 scan、独立 sync(write) 与末次 scan→sync(check) | 优先让末次验证接入已有同轮快照复用，再评估写后 source-valid scan 到同步的调用内复用；保留独立 revision 复读、完整索引比较和错误优先级。rename 锁外仅为取得 indexPath 的 scan 可先用位置 resolver 替代。 |
| 3 | Decision stage 只选 1 条仍耗 163–193 秒 | 分别 profile HEAD 基线读取、工作树身份发现和写前复核；优先去掉同轮重复物化，保持完整 pending、身份重现及漂移保护。不要因只选一条就省掉契约所需的集合验证。 |
| 4 | 小窗口查询约 4–11 秒；Decision 候选查询约 34–38 秒 | 继续检查 loader 到 reader 的字段提取／投影重复；候选发现可调查“正式集必要身份／安全证据＋仅候选完整正文”的分工。content 优先复用已有验证上下文；提前 cap 若改变诊断优先级，单独作为行为变更评审。 |

另有一项静态空间余量：Investigation metadata 当前先构造全部命中 DTO，再 `slice(limit)`。可以精确计数而仅保留窗口内 DTO，但本轮少命中样本不能量化这项收益。本轮没有独立计量构图、排序或解析阶段，不能用 trace 减 show 或不同命令的总时长相减作为阶段归因；现有结果也不足以支持更换持久索引格式或新增跨调用缓存。

### 证据与适用边界

覆盖核对确认 47 个场景各一个主样本、32 个命令齐全、实际 argv 一致、正式命令时间不重叠、272 份输出流字节及摘要匹配；成功和预算拒绝的后验均完成。采集器另用大输出、启动失败、整进程组超时及 wait4 成功样本验证协议。文档按 AI-Ready Docs 审核重心、边界、引用和 Markdown；项目验证结果另见 verification.json。

单样本用于识别数量级卡点，不能估计 p50／p95、证明线性增长或承诺生产延迟。结论适用于本次短正文、稀疏小组图、常数附件及单对象操作；五处 OOM 未取得同环境正常完成样本，也未做扩容对照或分配 profile，不能据此断言内存泄漏、精确崩溃语句或增大 heap 必然解决。

资源中的方法保留本轮形成时做法，作为证据阅读，不是长期维护的工具、测试入口或独立可运行包；旧调查资源未执行、未修改。原始观测中的临时路径通过 streams.jsonl 的 originalPath 对应归档全文，复核无需保留十万份合成文件。

## 随附资源

- [采集器输出、启动、超时及 wait4 协议验证](./_resources/261021-record-tools-all-operations-100k/collector-smoke.json)
- [固定版本全部公开命令帮助](./_resources/261021-record-tools-all-operations-100k/command-help.txt)
- [47 个场景的精确输入与预期效果](./_resources/261021-record-tools-all-operations-100k/coverage-manifest.json)
- [运行环境、默认 heap 与计量边界](./_resources/261021-record-tools-all-operations-100k/environment.json)
- [两域基线、字节规模与固定 HEAD](./_resources/261021-record-tools-all-operations-100k/fixtures.json)
- [五处 OOM 的写后对账与人工恢复](./_resources/261021-record-tools-all-operations-100k/incident-evidence.json)
- [本轮构造、采集、核对与证据整理方法](./_resources/261021-record-tools-all-operations-100k/methods.txt)
- [47 次完整主观测及准备与核对结果](./_resources/261021-record-tools-all-operations-100k/observations.jsonl)
- [本轮存量、小输入与失败隔离协议](./_resources/261021-record-tools-all-operations-100k/protocol.md)
- [固定版本源码和分发文件指纹](./_resources/261021-record-tools-all-operations-100k/source.sha256)
- [重复准备与峰值副本的静态调用依据](./_resources/261021-record-tools-all-operations-100k/static-audit.md)
- [272 份 stdout／stderr 全文与摘要](./_resources/261021-record-tools-all-operations-100k/streams.jsonl)
- [全操作耗时、CPU、RSS 与覆盖汇总](./_resources/261021-record-tools-all-operations-100k/summary.json)
- [覆盖、协议、审查与仓库验证记录](./_resources/261021-record-tools-all-operations-100k/verification.json)
