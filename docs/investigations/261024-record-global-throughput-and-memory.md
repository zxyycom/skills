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

局部操作收敛后，两域全量检查与同步仍需读取全集。本轮以 `f381715c0bfddd015503544c0fe38e8889809600`（DR 95、IR 85）为冻结来源，调查重复解析、全集读取和正文保留的剩余成本。既有契约要求 check 使用首次安全采集，同步及预检独立取得 fresh 来源；性能优化须保留这些验证责任。

调查先在隔离副本比较原型，再于同轮实施 DR 同阶段 frontmatter 复用。采用标准是正确性与低维护面，容许合理常数取舍。隔离原型的性能样本与后续实现的正确性证据分别解释。

## 调查目的

判断全量 check、full sync unchanged／changed／preflight 的主要工作量；比较 DR YAML 复用与 IR 身份提取优化的价值；确定一万条长正文的内存观察能支持哪些后续判断。

## 调查范围与依据

| 证据阶段 | 实际范围与来源 |
| --- | --- |
| 原始矩阵与原型 | Node v26.8.2 生成 CLI，新进程串行运行、页缓存已暖；Bun 1.4.2 仅核对版本。6 个可见 CPU，cgroup 配额 4 CPU／6 GiB。两域各 10,000 份无关系、无资源、无候选的非 Git 来源。 |
| 输入 | DR 正文 3,358,890 B、索引 5,359,147 B；IR 正文 3,408,890 B、索引 4,319,152 B。changed／preflight 只向一份正文追加 35 B，改变 revision 而保持 metadata 投影。 |
| 样本 | 8 场景各 3 次正常运行及 1 次诊断，另做 DR 四场景配对、独立 check 配对和 IR 短／长正文配对。合计 66 次正常、12 次诊断、8 次 smoke，全部保留，无非预期失败、超时或 OOM。 |
| 实施补证 | 2026-10-24 取得；以 `a661d059` 的七份 DR 域源码为对照，其余依赖共用当时工作区闭包。两记录夹具比较 baseline／source／generated 的四场景，另运行领域聚合及定向变异。未重跑万条性能矩阵。 |

正常指标为 monotonic 墙钟、wait4 user+system CPU 和最大进程 RSS。RSS 含 Node worker 线程，但不是同时全进程树内存；插桩耗时为 inclusive，存在嵌套。最终差异比较覆盖普通文件完整 SHA-256、size、mode，不覆盖瞬态写入或同字节重写。

原矩阵存在外部性能进程竞争，且 optional `supports-color` 9.4.0 在 loader 调查中途才被发现，缺少首样本前哈希。AB 前已将同字节包纳入隔离依赖并核对起止指纹；矩阵与 AB 因此属于不同依赖闭包。初始 DR check 配对可能与自有测试短暂重叠，另于 16:12:19–16:12:43 UTC 做独立三对；这里“独立”只表示已识别的 benchmark 和自有测试退出，不能保证宿主静默。

版本、依赖 SHA、输入 recipe、完整样本与方法修正保存在随附资源。源码与生成 runtime 经去生成头／恢复 shebang 注释后，两域 247／262 个模块逐字一致，另有 source／generated Node smoke。

## 调查结果与边界

### 结论

**采用 DR 同阶段 frontmatter 复用；IR 三行身份微优化暂不推进。**DR 复用消除了已确认的重复 YAML 工作，后续小夹具验证了源码与生成 CLI 的工作量及行为等价。IR 原型减少了身份计算，但没有一致端到端收益。两域同步的第二轮来源读取继续承担独立 fresh。

本轮没有证明落地版本的稳定加速比例或内存上界。额外解析对象的阶段内留存是 DR 方案的取舍，是否采用由正确性与维护面共同决定。

### 原始全量矩阵

时间为三次正常运行中位（最小–最大），调用计数来自独立诊断。

| 域／场景 | wall 秒 | CPU 中位秒 | RSS 中位 MiB | 正文读取／YAML 解析 |
| --- | ---: | ---: | ---: | --- |
| DR check | 4.018（3.667–10.838） | 5.078 | 297.3 | 10,000／20,000 |
| DR full sync unchanged | 7.728（7.543–9.210） | 8.887 | 318.2 | 20,000／30,000 |
| DR full sync changed | 7.124（7.010–7.681） | 8.306 | 340.7 | 20,000／30,000 |
| DR full sync preflight | 6.863（6.634–7.177） | 8.000 | 317.4 | 20,000／30,000 |
| IR check | 2.136（1.872–3.480） | 2.855 | 248.8 | 10,000／不适用 |
| IR full sync unchanged | 3.571（3.392–4.291） | 4.507 | 275.5 | 20,000／不适用 |
| IR full sync changed | 10.867（10.445–11.674） | 12.105 | 292.8 | 20,000／不适用 |
| IR full sync preflight | 10.736（9.856–11.675） | 12.376 | 270.8 | 20,000／不适用 |

check 每份正文恰读一次，sync／preflight 各读两次。IR 正式解析均为 10,000 次，身份提取分别为 10,000／20,000 次。矩阵顺序与宿主波动限制了时长解释：changed／unchanged 的差异不足以归因为命令本身，也不足以比较两域性能排名。

### DR：重复解析、性能取舍与实现证据

基线在成员发现和正式解析中分别解同一份 YAML。check 诊断累计 20,000 次、inclusive 2.269 秒，确认了重复工作。原型保留本阶段 frontmatter，实测 check YAML **20,000→10,000**、sync unchanged **30,000→20,000**；正文读取仍为 10,000／20,000 次。changed／preflight 的计数只按同流程推断，未单独插桩。

独立 check 三对按 A/B、B/A、A/B 执行，表中统一展示 baseline→prototype：

| 对 | wall 秒 | CPU 秒 | RSS MiB |
| --- | --- | --- | --- |
| 1 | 4.030→3.230 | 5.163→4.280 | 308.6→294.6 |
| 2 | 5.279→3.006 | 6.435→4.010 | 299.1→300.4 |
| 3 | 3.150→2.571 | 4.043→3.398 | 293.5→296.0 |

check 三对 wall 均下降；unchanged／preflight 也各三对下降，changed 有一对反向，原型 wall 中位 13.233 秒高于 baseline 10.913 秒。changed／preflight 原型 RSS 中位分别高约 19.8／20.1 MiB。样本支持减少重复工作，但同时保留了延迟与内存取舍，尚无精确对象保留或 GC 因果归因。

12 项原型 CLI 对照覆盖合法输入、BOM／CRLF、YAML 及字段错误、重复身份、正文、关系目标和采用字段；完整退出、stdout／stderr、索引 SHA 与最终文件差异一致。原型用未绑定的解析参数交接，落地则在 [解析 owner](../../tools/decision-records/src/decision-metadata.ts) 内用 `DecisionMarkdownSource` 绑定原始文本与私有解析结果。成员发现和正式扫描消费同一来源；公开 raw 入口自行解析，fresh 独立重读。相比跨调用缓存或提前存储完整验证结果，该局部对象保持了错误身份发现和阶段责任，无额外无效化状态。

后续实施证据与上述性能样本分开：

- 两记录夹具的 source／generated check 各为 **2 次 YAML／2 次来源打开**，对照为 4／2；三类 sync 各为 **4／4**，对照为 6／4。12 次运行按场景比较完整退出、stdout／stderr、最终 SHA-256 和 mode，结果相同。
- 六个原生节点覆盖 raw 入口、字节绑定、诊断顺序、无效字段参与重复身份判定、独立 fresh 及 sync 失败时的索引保护；三个定向变异均被对应节点识别。
- DR 聚合最终 **395 通过／0 失败**，全仓类型检查通过。首次失败与修正过程保存在实施资源，包含诊断预期、内部观察位置及生成声明清单的调整。
- 同轮联合生成、版本和账本同步完成后，2026-10-24 18:13 UTC 的 `bun run check:changed` 为 **66 通过／0 失败／3 不适用**；最终版本调整后的增量复验通过。这是本地验收，不是发布或远端 CI 证明。

### IR：身份优化不是主要成本，长文仍有全集保留

身份 helper 只消费前三行，原实现却 normalize／split 全篇。隔离原型改为限三行的 CRLF／CR／LF split，保持完整读取、正式解析、fresh 及“不去 BOM”的语义；1,026 项等价样例通过。

短文诊断中身份提取约 19 ms、正式解析约 102 ms；layout 1.752 秒内含 reader 1.689 秒。长文每份 8,306–8,309 B、53 行，共 83,088,890 B（约 79.2 MiB）。长文身份诊断 **55.18→7.42 ms**，两版仍读取全部 10,000 份正文、正式解析 10,000 次。

| check 形态 | baseline wall 三次秒 | prototype wall 三次秒 | RSS 中位 baseline→prototype MiB |
| --- | --- | --- | --- |
| 短正文 | 1.663／2.004／1.724 | 1.699／1.651／1.706 | 268.4→267.7 |
| 长正文 | 2.207／1.988／2.076 | 1.996／2.135／2.173 | 418.5→420.7 |

长文一对快、两对慢，正常最大 RSS 422.1 MiB、未 OOM。长文诊断在布局收齐时 RSS 约 365.6 MiB、heapUsed 178.5 MiB，最终索引检查阶段末 RSS 422.9 MiB；这些是未强制 GC 的阶段末值。主线程仍保留全集文本，块交接只提供背压。更大的生命周期或流水线改造，需要先取得对象保留责任的区分性证据。

### 适用边界与复查条件

- 当前实现补证证明所测流程的工作量与行为，未新增大规模性能或容量结论。原型对照也没有独立全索引 oracle。
- 性能样本未覆盖冷盘、十万条、资源密集、复杂关系图、Git 历史、并发修改／中断回滚、权限或恶意路径。领域回归只证明其实际断言，不能替代这些形态的性能或全面并发证明。
- IR 资源校验与未引用 warning 的串行结构仅作静态确认；零资源输入不足以证明优化它们的收益。
- 当真实集合的正文、资源或关系显著增加，或解析／reader／来源快照生命周期改变时，按对应形态重测。RSS 不能外推为生产容量，工作量减少也不等于所有平台稳定加速。

随附资源保留完整样本、反向结果和形成时方法；原型补丁与测量代码用于审查当时做法，当前实现与验证入口由源码和测试 owner 维护。

## 随附资源

- [审计：全部样本、配对与证明边界](./_resources/261024-record-global-throughput-and-memory/audit.json)
- [正确性：DR CLI 与 IR 身份等价](./_resources/261024-record-global-throughput-and-memory/correctness.json)
- [环境与输入：冻结、实际依赖与正文形态](./_resources/261024-record-global-throughput-and-memory/environment-and-inputs.json)
- [当前落地：方法、验证命令与失败处理](./_resources/261024-record-global-throughput-and-memory/implementation-methods.md)
- [当前落地：计数、等价输出、源码 SHA 与变异结果](./_resources/261024-record-global-throughput-and-memory/implementation-verification.json)
- [全部样本：指标、输出与最终文件差异](./_resources/261024-record-global-throughput-and-memory/measurements.json)
- [形成时方法：准备、测量、插桩与对照代码](./_resources/261024-record-global-throughput-and-memory/methods.md)
- [阶段：调用次数、inclusive 耗时与阶段末内存](./_resources/261024-record-global-throughput-and-memory/profiles.json)
- [协议：窗口、计量、边界与留存](./_resources/261024-record-global-throughput-and-memory/protocol.md)
- [DR 隔离原型补丁](./_resources/261024-record-global-throughput-and-memory/prototype-dr.patch)
- [IR 隔离原型补丁](./_resources/261024-record-global-throughput-and-memory/prototype-ir.patch)
- [来源：路径展示、代码哈希与方法纠正](./_resources/261024-record-global-throughput-and-memory/provenance.json)
- [统计：各窗口各分组 min／median／max](./_resources/261024-record-global-throughput-and-memory/summary.csv)
