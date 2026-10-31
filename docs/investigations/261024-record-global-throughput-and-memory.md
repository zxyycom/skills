---
title: "记录工具全量检查与同步的吞吐及内存调查"
id: "261024-record-global-throughput-and-memory"
formedAt: "2026-10-24T15:59:55Z"
question: "局部操作收敛后，全量检查与同步的剩余吞吐和内存成本由哪些阶段产生，哪些隔离优化值得落地？"
tags:
  - "decision-records"
  - "investigation-report"
  - "performance"
  - "scale-testing"
relations:
  - type: "补充"
    target: "261024-record-tools-entry-matrix-10k"
    summary: "在局部化后定位全量检查与同步的剩余成本"
---

## 形成时背景

局部操作收敛后，Decision Records（DR）与 Investigation Report（IR）的全量检查和同步仍需读取全集。本轮从 `f381715c`（DR 95、IR 85）调查重复解析、全集读取和正文保留，随后实施 DR 同阶段 frontmatter 复用，并补测落地版。

采用标准是：在保持正确性和阶段责任的前提下，以较小维护面消除重复工作，并明确性能取舍。check 使用首次安全采集；sync／preflight 独立取得 fresh 来源。三类证据——原型、实施验证、落地版复测——按各自版本和窗口解释。

## 调查目的

定位全量 check、full sync unchanged／changed／preflight 的主要成本，判断 DR YAML 复用与 IR 身份提取优化是否值得采用，并明确万条长正文的内存观察及后续复查条件。

## 调查范围与依据

### 输入与证据阶段

两域各 10,000 份无关系、无资源、无候选的非 Git 来源。DR 正文／索引为 3,358,890／5,359,147 B；IR 为 3,408,890／4,319,152 B。changed／preflight 只向一份正文追加 35 B，改变 revision、保持 metadata 投影。IR 长文 check 另使用 83,088,890 B 正文，单份 8,306–8,309 B、53 行。

| 阶段 | 冻结来源、实际时点与覆盖 |
| --- | --- |
| 原型 | 2026-10-24，`f381715c`，DR 95／IR 85；8 场景矩阵、DR 四场景配对、独立 check 配对及 IR 短／长文配对，共 66 次正常、12 次诊断、8 次 smoke。 |
| 实施验证 | 同日，以 `a661d059` 的七份 DR 域源码为对照，其余依赖共用当时工作区闭包；两记录夹具比较 baseline／source／generated 四场景，另做领域聚合和定向变异。 |
| 落地版复测 | 同日 19:32:05–19:37:17 UTC 修正窗口，`ef809161`，DR 98／IR 87；DR 四场景各 3 对，IR 四场景及长文 check 各 3 次，共 39 次正常、6 次闭包 smoke。 |

本文“落地版”固定指 `ef809161`。DR 对照仅撤回同阶段复用的七份源码及对应生成文件；envelope 冻结和其余闭包相同。IR 只报告该版本的时延与内存。原型明细、实施记录及复测原始数据分别由随附资源承接。

### 计量与窗口选择

Node v26.8.2 生成 CLI 在新进程中串行运行，文件缓存已暖；Bun 1.4.2 用于版本核对。环境可见 6 CPU，cgroup 配额 4 CPU／6 GiB。wall 为 monotonic 墙钟，CPU 为 wait4 user+system，RSS 为进程高水位、含 Node worker 线程；它不同于同时进程树总内存或 JS live heap。每组 3 次，配对顺序 A/B、B/A、A/B；百分比为两组中位之比减一。

**复测表只使用修正窗口。**首轮长文后验使大 oracle 父进程的 fork 前 RSS 高水位进入子进程计量；控制实验确认后，改由 resident 15,096–15,328 KiB 的独立进程计量，并完整重跑两报告矩阵。两轮各 63 次正常＋14 次 smoke 及 3 个计量控制全部保留，不跨窗口合并。控制数值、采样代码和窗口字段见[共享复测方法](./_resources/261024-record-global-throughput-and-memory/current-version-methods.md)。

原型矩阵受外部性能进程竞争影响；optional `supports-color` 9.4.0 在 loader 调查中途才被发现，缺少首样本前哈希，矩阵与后续 AB 属于不同依赖闭包。初始 DR check 配对可能与自有测试重叠，因此另于 16:12:19–16:12:43 UTC 做独立三对。落地版复测在采样前冻结实际依赖，起止指纹一致；端点仍可见常驻 Node／CodeGraph，进程快照不足以排除窗口内或宿主干扰。

原型阶段另核对源码与生成 runtime：去除生成头并恢复 shebang 注释后，两域 247／262 个模块逐字一致，另有 source／generated Node smoke。

## 调查结果与边界

### 采用判断

**采用 DR 同阶段 frontmatter 复用；IR 三行身份微优化暂不推进。**DR 消除了重复 YAML 工作，实施验证支持源码与生成 CLI 的工作量及行为等价；落地版四场景 wall 中位均下降，同时保留 changed 的单对变慢和三个场景的 RSS 中位上升。IR 原型减少了身份计算，却未带来一致的端到端收益。

这支持局部、低维护面的 DR 复用，不承诺稳定加速比例。同步的第二轮来源读取继续承担独立 fresh；全集保留的内存责任需要单独调查。

### 落地版复测：实际时延与内存

每格为 3 次中位，括号为最小–最大；CPU 为 user+system。

| 落地版场景 | wall 秒 | CPU 中位秒 | 峰值 RSS MiB |
| --- | ---: | ---: | ---: |
| DR check | 2.579（2.560–2.737） | 3.375 | 299.2（298.1–300.0） |
| DR full sync unchanged | 6.655（5.302–7.441） | 7.960 | 320.4（319.2–340.4） |
| DR full sync changed | 6.134（5.791–6.348） | 7.381 | 352.0（339.5–360.6） |
| DR full sync preflight | 5.342（5.245–6.003） | 6.339 | 330.3（317.5–341.3） |
| IR check | 1.651（1.642–1.674） | 2.185 | 256.7（254.4–268.6） |
| IR full sync unchanged | 2.652（2.504–4.148） | 3.374 | 276.9（270.1–290.4） |
| IR full sync changed | 2.703（2.632–2.825） | 3.437 | 292.7（284.8–292.7） |
| IR full sync preflight | 2.627（2.471–4.192） | 3.337 | 284.9（260.5–290.7） |
| IR 长文 check | 2.005（1.922–2.399） | 2.688 | 426.2（420.5–426.3） |

以下仅比较同一复测闭包的 DR 撤回版→落地版，逐对数据见复测资源。

| DR 场景 | wall 变化 | CPU 变化 | RSS 变化 | wall 变慢对数 |
| --- | ---: | ---: | ---: | ---: |
| check | -16.9% | -15.0% | +0.3% | 0/3 |
| unchanged | -20.9% | -16.5% | -2.1% | 0/3 |
| changed | -3.0% | -2.5% | +3.1% | 1/3 |
| preflight | -10.2% | -9.5% | +4.0% | 0/3 |

具体取舍：changed 第 1 对 wall **6.064→6.134 秒**、CPU 7.104→7.381 秒，三对 RSS 均上升；unchanged 的 RSS 中位虽下降，仍有一对上升。IR 长文 RSS 中位 426.2 MiB、最大 426.3 MiB，未 OOM；该结果是此输入的观察值，不是容量上界。

两轮每对完整输出与最终文件效果一致；修正窗口以独立 oracle 核对完整来源和索引。preflight 保持刻意陈旧的索引，只证明无最终改写。起止源码、生成文件和依赖指纹相同，source／generated Node smoke 的实际文件 URL 均在隔离副本内。

### DR：重复工作如何消除

原型诊断确认：成员发现和正式解析分别解同一份 YAML。check 累计 20,000 次、inclusive 2.269 秒；复用后 check YAML **20,000→10,000**，sync unchanged **30,000→20,000**，正文读取仍为 10,000／20,000 次。changed／preflight 的相同计数按流程推断，未单独插桩。

原型独立 check 三对 wall 均下降，unchanged／preflight 也各三对下降；changed 有一对反向，wall 中位 **10.913→13.233 秒**。changed／preflight 原型 RSS 中位分别增加约 19.8／20.1 MiB。完整原型矩阵和逐对数值保存在资源；它们说明采用时已有延迟和内存取舍，不能与落地版混算。

12 项原型 CLI 对照覆盖合法输入、BOM／CRLF、YAML 及字段错误、重复身份、正文、关系目标和采用字段；完整退出、stdout／stderr、索引 SHA 与最终文件差异一致。落地实现由[解析 owner](../../tools/decision-records/src/records/decision-metadata.ts)的 `DecisionMarkdownSource` 绑定原文与私有解析结果，成员发现和正式扫描消费同一来源；公开 raw 入口自行解析，fresh 独立重读。复用限于单阶段对象，无跨调用缓存或失效管理。

实施验证进一步确认：

- 两记录夹具的 source／generated check 均为 **2 次 YAML／2 次来源打开**，对照为 4／2；三类 sync 均为 **4／4**，对照为 6／4。12 次运行按场景比较退出、完整输出、最终 SHA-256 和 mode，结果相同。
- 六个原生测试节点覆盖 raw 入口、字节绑定、诊断顺序、无效字段参与重复身份判定、独立 fresh 及 sync 失败时的索引保护；三个定向变异均被识别。
- DR 聚合 **395 通过／0 失败**，全仓类型检查通过；联合生成、版本和账本同步后，18:13 UTC 的 `bun run check:changed` 为 **66 通过／0 失败／3 不适用**，最终版本调整后的增量复验通过。首次失败及修正细节由实施资源保留。

### IR：身份计算与全集保留

身份 helper 只消费前三行，原实现却 normalize／split 全篇。原型改用限三行的 CRLF／CR／LF split，保持完整读取、正式解析、fresh 及不去 BOM 的语义；1,026 项等价样例通过。

短文诊断中身份提取约 19 ms、正式解析约 102 ms；layout 1.752 秒包含 reader 1.689 秒。长文身份计算 **55.18→7.42 ms**，两版仍读取和正式解析全部 10,000 份正文；正常配对一对快、两对慢，RSS 中位 **418.5→420.7 MiB**。这些结果支持把优化重点放在更大成本上。

长文原型诊断在布局收齐时 RSS 约 365.6 MiB、heapUsed 178.5 MiB，最终索引检查阶段末 RSS 422.9 MiB，均为未强制 GC 的阶段末值。主线程仍保留全集文本，块交接提供背压而不释放全部来源。生命周期或流水线改造需要先取得对象保留责任的区分性证据。

### 证明边界与复查条件

- 落地版复测覆盖上述暖缓存、万条合成输入及独立全索引后验；早期原型没有该独立 oracle。最终文件比较覆盖普通文件完整 SHA-256、size、mode，不覆盖瞬态写入或同字节改写。
- 阶段诊断是 inclusive 计时，存在嵌套；落地版未重做阶段插桩或 heap／GC 实验。重复工作减少已有证据，全部 CLI 差额的因果归属仍未知。
- 冷盘、十万条、资源密集、复杂关系图、Git 历史、并发修改／中断回滚、权限或恶意路径未进入本性能矩阵。IR 资源校验和未引用 warning 的串行结构仅作静态确认，零资源输入不足以估计其优化收益。
- 正文、资源、关系规模显著增长，或解析、reader、来源快照生命周期改变时，按对应形态重测。三次样本不足以给出生产尾延迟、稳定比例或容量保证；本地测试与 Gate 仅证明实际验收范围。

资源中的原型补丁和测量代码供复核形成时做法；当前实现与验证入口由源码和测试 owner 维护。

## 随附资源

- [原型审计：样本、配对与证明边界](./_resources/261024-record-global-throughput-and-memory/audit.json)
- [原型正确性：DR CLI 与 IR 身份等价](./_resources/261024-record-global-throughput-and-memory/correctness.json)
- [落地版复测：计量修正、完整方法与输入模板](./_resources/261024-record-global-throughput-and-memory/current-version-methods.md)
- [落地版复测：冻结、闭包、输入、控制与保真审计](./_resources/261024-record-global-throughput-and-memory/current-version-provenance.json)
- [落地版复测：两窗口分组与全部逐对变化](./_resources/261024-record-global-throughput-and-memory/current-version-results.json)
- [落地版复测：首轮及修正轮全部原始指标](./_resources/261024-record-global-throughput-and-memory/current-version-samples.jsonl)
- [落地版复测：按原始 SHA 去重的完整输出](./_resources/261024-record-global-throughput-and-memory/current-version-streams.json)
- [环境与输入：冻结、实际依赖与正文形态](./_resources/261024-record-global-throughput-and-memory/environment-and-inputs.json)
- [实施验证：方法、命令与失败处理](./_resources/261024-record-global-throughput-and-memory/implementation-methods.md)
- [实施验证：计数、等价输出、源码 SHA 与变异结果](./_resources/261024-record-global-throughput-and-memory/implementation-verification.json)
- [原型样本：指标、输出与最终文件差异](./_resources/261024-record-global-throughput-and-memory/measurements.json)
- [原型方法：准备、测量、插桩与对照代码](./_resources/261024-record-global-throughput-and-memory/methods.md)
- [原型诊断：调用次数、inclusive 耗时与阶段末内存](./_resources/261024-record-global-throughput-and-memory/profiles.json)
- [协议：窗口、计量、边界与留存](./_resources/261024-record-global-throughput-and-memory/protocol.md)
- [DR 隔离原型补丁](./_resources/261024-record-global-throughput-and-memory/prototype-dr.patch)
- [IR 隔离原型补丁](./_resources/261024-record-global-throughput-and-memory/prototype-ir.patch)
- [来源：路径展示、代码哈希与方法纠正](./_resources/261024-record-global-throughput-and-memory/provenance.json)
- [原型统计：各窗口各分组 min／median／max](./_resources/261024-record-global-throughput-and-memory/summary.csv)
