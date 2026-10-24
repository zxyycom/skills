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

本轮按当前版本重新调查全量检查与同步，不把旧报告的时长视为当前事实或直接加速比。冻结来源为 `f381715c0bfddd015503544c0fe38e8889809600`，DR 95、IR 85；局部操作收敛后，待判断的剩余问题是全集读取、重复解析与正文保留的成本。已有契约要求：check 使用首次安全采集，同步和预检仍独立 fresh；不能用删去必要复核换取速度。

最初阶段只在隔离副本尝试两项候选，没有把原型直接写入维护源码。随后在同轮内，按“正确性优先、低复杂度、容许合理常数回退，不要求所有场景加速”的标准重新评估并落地 DR 同阶段 frontmatter 复用，补充正确性证据；旧矩阵与原型样本保持原样，不作为本次实现的测速结果。前序报告提供入口分类背景，不是跨报告测速复用。

## 调查目的

回答：两域全量 check、full sync unchanged/changed/preflight 当前做多少工作；DR 同阶段 YAML 重解、IR 身份提取扫描整篇是否值得优先优化；一万条长正文的内存现象是否支持更大改造。否定或暂缓候选同样是本轮结果，不承诺优化有效。

## 调查范围与依据

- 原隔离矩阵：真实 Node v26.8.2 生成 CLI，新进程、串行、页缓存已暖；该阶段 Bun 1.4.2 仅核对版本。主机 6 个可见 CPU，cgroup CPU 配额 4 核、内存 6GiB。未安装、联网、调整频率/环境或强制 GC。
- 每域 10,000 份无关系、无资源、无候选的非 Git 合成来源。DR 正文合计 3,358,890B，索引 5,359,147B；IR 正文 3,408,890B，索引 4,319,152B。changed/preflight 只在一份正文末尾增加同样 35B，验证来源 revision 变化而不改 metadata 投影。
- 矩阵 8 场景各 3 正常 + 1 插桩诊断。另做 DR 四场景各三对、独立 check 三对、IR 短/长正文 check 各三对和原型诊断。正式共 66 正常、12 诊断，另有 8 次 smoke；全部保留，无非预期失败、超时、OOM 或删样。
- 指标为 monotonic 墙钟、wait4 user+system CPU、最大进程 RSS（含 Node worker 线程，非全后代同时内存之和）。插桩阶段为 inclusive、不可相加，不用其占比冒充正常运行分解。前后树哈希不进入计时；最终差异比较覆盖普通文件完整 SHA、size、mode，不覆盖瞬态写入或同字节重写。
- 原矩阵有外部性能进程竞争，且 loader 中途才发现外部 optional `supports-color` 9.4.0；该文件缺少首样本前哈希。AB 前将同字节包复制进隔离依赖目录，base/proto 起止指纹相等。因此矩阵与 AB 是不同依赖闭包的观察，不混算收益。初始 DR check 三对可能与自有正确性短暂重叠，单列保留；16:12:19–16:12:43 UTC 另做固定顺序三对。这里“独立/quiet”只表示已识别 benchmark 与自有测试退出，不保证宿主静默。

- 后续实现补证于 2026-10-24 取得，DR 域源码对照基线为 `a661d059`：只回放任务改变的七份 DR 源码，其他依赖使用同一当前工作区闭包。两记录小夹具覆盖 source/generated CLI 的 check、full sync unchanged/changed/preflight，各与原 DR 域实现比较；另运行领域聚合、原生节点和三个定向内存变异。不重跑万条性能矩阵，不新增时长或 RSS 收益主张。详细时点、源码 SHA、输出与方法见 `implementation-verification.json` 和 `implementation-methods.md`。

版本、依赖实际装载 SHA、输入字节/行数、窗口、完整样本与方法修正均在随附资源。源码与生成 runtime 经去生成头/恢复 shebang 注释后两域 247/262 个模块逐字一致，并做 source/generated Node smoke。

## 调查结果与边界

### 结论与原矩阵基线

**已以局部封装落地 DR 同阶段解析交接；不优先推进 IR 三行身份微优化，也不引入持久缓存或流水线框架。**原矩阵支持 DR 存在重复 YAML 工作，本次小夹具实测确认当前源码和生成 CLI 都减少同阶段解析且保持行为。接受额外解析对象的阶段内留存及合理常数回退，不把所有场景变快作为验收条件；未证明当前实现的端到端加速比例或内存上界。两域同步的第二轮来源读取属于 fresh，继续独立保留。

下表仅描述原矩阵当时的环境，时间为三次正常运行中位（最小–最大）；每域/场景的诊断单列计数，不与时长拼接成因果比例。

| 域/场景 | wall 秒 | CPU 中位秒 | RSS 中位 MiB | 正文读取 / YAML 解析 |
| --- | ---: | ---: | ---: | --- |
| DR check | 4.018（3.667–10.838） | 5.078 | 297.3 | 10,000 / 20,000 |
| DR full sync unchanged | 7.728（7.543–9.210） | 8.887 | 318.2 | 20,000 / 30,000 |
| DR full sync changed | 7.124（7.010–7.681） | 8.306 | 340.7 | 20,000 / 30,000 |
| DR full sync preflight | 6.863（6.634–7.177） | 8.000 | 317.4 | 20,000 / 30,000 |
| IR check | 2.136（1.872–3.480） | 2.855 | 248.8 | 10,000 / 不适用 |
| IR full sync unchanged | 3.571（3.392–4.291） | 4.507 | 275.5 | 20,000 / 不适用 |
| IR full sync changed | 10.867（10.445–11.674） | 12.105 | 292.8 | 20,000 / 不适用 |
| IR full sync preflight | 10.736（9.856–11.675） | 12.376 | 270.8 | 20,000 / 不适用 |

成功 check 每份正文恰读一次；full sync/preflight 各读两次。IR check 正式解析 10,000 次、身份提取 10,000 次；同步正式解析仍 10,000 次、身份提取 20,000 次。原矩阵顺序与宿主波动使 changed/unchanged 的时差不能归因为命令固有差异，更不能用于跨域排名。

### DR：重复 YAML 成立，但原型不等于可直接合并

原矩阵基线的 [来源成员检查](../../tools/decision-records/src/scan-collection.ts)通过身份 helper 解 YAML，[正式解析](../../tools/decision-records/src/decision-metadata.ts)再解同一份字节。诊断 check 的 YAML 累计 inclusive 2.269s、20,000 次；它是候选定位依据，不是正常 wall 的精确占比。

隔离原型在 `SourceFile` 保留本阶段已解 frontmatter，并显式传给正式校验；独立 fresh 仍从实际来源重新读取/提取身份。诊断实测为 check YAML **20,000→10,000**、full sync unchanged **30,000→20,000**；changed/preflight 仅做正常 AB，计数沿同流程推断，未分别对原型插桩实测。上述 check/unchanged 诊断的成功正文读取仍分别为 10,000/20,000，不使用跨调用缓存、不跳过正文或诊断。原型阶段没有向副本外应用该补丁；本次落地采用下文的不同内部接口。

独立 check 三对按 A/B、B/A、A/B 执行，下面统一按 baseline→prototype 展示：

| 对 | wall 秒 | CPU 秒 | RSS MiB |
| --- | --- | --- | --- |
| 1 | 4.030→3.230 | 5.163→4.280 | 308.6→294.6 |
| 2 | 5.279→3.006 | 6.435→4.010 | 299.1→300.4 |
| 3 | 3.150→2.571 | 4.043→3.398 | 293.5→296.0 |

三对 check wall 均下降，支持继续内部解析交接，但不证明稳定加速百分比。其他 AB 场景均完整保留：unchanged/preflight 三对 wall 都降，changed 一对反向；changed 原型中位 13.233s、baseline 10.913s，不能宣称全命令一致加速。内存也未改善成定论：changed/preflight 原型 RSS 中位分别高约 19.8/20.1MiB，存在保留额外 YAML 对象及 GC 状态的取舍，尚未做精确对象归因。

12 项 DR CLI 对照覆盖合法、BOM/CRLF、坏 YAML/非 mapping/重复 key、无效字段/tag/ID、重复 ID、坏正文、缺关系目标和空采用字段；两版完整退出、stdout/stderr 与最终文件差异相同。所有 AB 及正常/诊断的完整输出、索引 SHA 与最终差异也一致。**这不是独立全索引 oracle，也未验证并发漂移/恢复。**原型增加了内部解析输入参数；这决定了后续落地需要绑定本阶段原始字节，不让公开调用方以传入解析对象绕过来源解析，并补充 fresh 与错误诊断证据；内存取舍不等同于已经取得容量上界。

### IR：身份计算变少，没有可主张的总体收益

[身份 helper](../../tools/investigation-report/src/markdown.ts)仅消费前三行，原实现却 normalize/split 全篇。极小原型只在此处改为限三行的 CRLF/CR/LF split，正式解析、正文完整读取和 fresh 都不变；1026 项等价样例覆盖混合换行、BOM、短/坏输入与固定种子扰动，保持原“不去 BOM”的语义。

短正文诊断身份提取 19ms、正式解析 102ms；layout 1.752s 中 reader 阶段 1.689s（后者嵌套，不能相加）。它不是当前短文主要计算成本。

长正文每份 8,306–8,309B、53 行，增加 7,968B ASCII 段，10,000 份合计 83,088,890B，约 79.2MiB；不是十万条容量实验。identity 诊断累计由 55.18→7.42ms，仍各读 10,000 份完整正文、83,088,890B，正式解析仍 10,000 次。

| check 形态 | baseline wall 三次秒 | prototype wall 三次秒 | RSS 中位 baseline→prototype MiB |
| --- | --- | --- | --- |
| 短正文 | 1.663 / 2.004 / 1.724 | 1.699 / 1.651 / 1.706 | 268.4→267.7 |
| 长正文 | 2.207 / 1.988 / 2.076 | 1.996 / 2.135 / 2.173 | 418.5→420.7 |

长正文一对快、两对慢；正常最大 RSS 422.1MiB、未 OOM。没有一致端到端收益，故不优先落地这个微优化。长文诊断在收齐布局时 RSS 已约 365.6MiB、heapUsed 178.5MiB，最终索引检查阶段末 RSS 422.9MiB；这些是未强制 GC 的阶段末观察，不是各组件精确占用。现有块交接限制只提供背压，主线程仍保留全集文本；仅把 acquired map 改为边收边处理并不能自动消除后续 revision 所需的全文保留。

### DR：低复杂度落地与当前补证

落地位于 `tools/decision-records/src/decision-metadata.ts`、`record.ts` 和现有扫描 owner。`DecisionMarkdownSource` 只接收原始字符串，私有保存规范化 Markdown 与 YAML 解析结果，对外给出该份文本的身份及正式字段解析。`SourceFile` 用这一对象替换旧身份 sidecar；正式扫描从同一对象取得身份、正文和原始来源文本，不接受独立的 optional parsed 参数。两个局部来源构造者去掉旧身份预填，未改变维护入口原有的身份漂移检查。公开原始 `parseDecisionMarkdown` / `validateDecisionBody` 每次仍从原始输入构造并验证；fresh 仍独立读取和解析，未修改其责任路径。

最小性比较：原型的未绑定 optional frontmatter 会扩大错误组合；跨调用缓存需额外无效化状态；提前正式验证并保存结果则需另存诊断，且不能因字段无效而抹去仍合法的成员身份。局部对象承接已有的同阶段身份与解析责任，不新增模块、配置、依赖、持久状态或通用缓存框架，也不建立内部没有消费者的 text 比对回退。解析对象只在本次扫描的来源数组中留存，扫描结果不携带它；没有为此增加精确 retained-heap 或容量结论。

当前补证与旧原型样本分开：

- 两记录真实 Node 小夹具中，source/generated check 各执行 **2 次 YAML / 2 次来源打开**，原域实现为 4/2；full sync unchanged、changed、preflight 各执行 **4 次 YAML / 4 次来源打开**，原域实现为 6/4。12 次运行逐场景的完整退出、stdout/stderr 和最终普通文件 SHA-256、mode 相同。只证明该流程的工作量及等价性，不证明实际负载的速度、内存或独立索引 oracle。
- 新增六个可独立选择的原生节点，覆盖原始输入不能被伪造 parsed 参数替代、BOM/CRLF 与精确来源文本、坏 YAML/非 mapping/重复 key 的诊断顺序、无效字段仍参与重复身份判定、独立 fresh 对正文/坏身份/删除的观察，以及真实源码 CLI 在第二次取得坏 YAML 时保持索引字节不变并保留并发来源。既有两项成员发现测试仅更新内部对象观察位置，证明意图不变。
- 三个进程内变异分别引入“字段无效便抹去成员身份”“忽略 YAML 错误”“fresh 复用旧身份”；各自目标节点失败，未变异对照通过。它们提供目标错误敏感性，不是任意缺陷检测保证。
- DR 完整聚合首次 **394 通过 / 1 失败**：生成声明闭包合法新增 metadata 及 metadata-types 两文件，而原测试固定列表未更新。核对实际闭包后最窄更新预期，定点隔离消费者编译通过，随后完整聚合 **395 通过 / 0 失败**。不是通过放宽产品断言消除失败。首次新测试还有两项预期诊断拼写/映射错误，修正为既有 YAML 大小写与 CLI 稳定错误语义后通过；早期类型检查发现旧身份 sidecar 构造者与测试观察，已一同对齐。
- 最终全仓 `tsgo --noEmit` 通过；任务相关定点格式、类型感知 lint 与 diff 检查见补证资源。联合生成、版本、索引与全仓 Gate 由各自 owner 验收，不能以本节领域测试代替。

### 选择、未覆盖与复查条件

- **选择**：保留已落地的 DR 局部同阶段解析复用，以当前正确性与低复杂度证据验收，不要求所有形态加速或先建立精确内存上界。IR 身份微优化仍不推进；更大的生命周期/流水线方案需先取得能区分对象保留责任的证据。
- **未覆盖**：本次实现没有重跑冷盘、万条/十万条、资源密集或复杂关系图性能及容量；原矩阵也不覆盖 Git 历史、并发修改/中断回滚、权限与恶意路径、独立索引 oracle、FS 瞬态写入。领域聚合及新增用例只对其真实断言的行为提供证据，不把这些行为通过扩展为上述形态的性能或全面并发保证。IR `validateResourceIds`/未引用 warning 的串行结构只经静态确认；本轮零资源输入不能证明其性能收益。RSS 不能外推为生产容量或同时全进程树内存上界。
- **复查条件**：目标真实集合显著增加正文/资源/关系，或变更解析、reader、来源 snapshot 生命周期时，按对应形态重测；不能沿用本轮秒数或把工作量减少等同于所有平台上的稳定加速。

资源中的 `audit.json` 记录逐对/逐场景机械对账；`measurements.json` 保存全部 86 行和按原 SHA 去重的完整输出；`profiles.json` 保存独立计数与阶段末内存；`environment-and-inputs.json` 与协议解释冻结、窗口及依赖缺口。方法与两份补丁供审查形成时做法，不是新的产品工具或直接合并授权。

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
