# Record CLI 图与领域验证切面：实际调查结果

采集：2026-11-08 06:26–06:29 UTC；HEAD `c1161cf1db52cf2de9ba5e0829808e18ebdccf19`，Linux 6.18.33.2 WSL2 x86_64。原生候选 release 资产 DR SHA-256 `42bdfe5113c4a6ffa404efa54eb68f42a42003a92f51e3529b5ddd5ef8fe2a6b`、IR `1e1aa4a14553239e2cbe22723d738ee53b3dc46b53ba9a355add3825c453ab20`；与 `/workspace/skills/dist/record-cli-perf-261107-main/source/` 中 index、图、事件、筛选、trace 关键 10 个文件逐字节相同。源码快照身份见该资产 `record-cli-candidate.json`。私有 fixture 的 sync/check、trace 都只调用原候选 release；旧 fixture 原样只读使用。

## 覆盖和结果

| 切面 | 已读及动态结果 | 限制 |
| --- | --- | --- |
| 公共图及严格索引 | `src/index.rs`, `src/domains/graph.rs`, `src/domains/{decision,investigation}/graph.rs`；两域合法图命中目标发布入口，动态正常见下 | schema 异常、孤立 ID、自环、环、重复 target、目标状态/时间错误未动态枚举；字段与建图失败边界为源码/契约阅读，不声称异常测试通过 |
| 双域 trace 正常、边界 | `trace_probe.py`：n32 三次/例，width40、width200 各一次/例，共 50 次独立期望通过：小拆分预算阻塞；DR 小重划/IR 小归并阻塞；复杂事件 context；普通链深度 frontier；宽归并加链完整遍历 | 独立期望见脚本；覆盖 traceIds、contextIds、frontier、coverage、blockedEvent；无 20 次分布统计，且大小图拓扑、字节、输出变动不能视为纯内核隔离 |
| 普通高直接度与关系条件 | `ordinary_probe.py`：私有 DR 100 点 50 条修订边，IR 前轮 width40 中 250 点 94 条边（其中普通入度 40）；检查 successors 预算 2 的 trace 精确 frontier 与 related-to successors list 总数 50/40 均通过 | 单次，输入不等大，输出随扇出变化；只检相关筛选结果总数，未独立核对 filterRelations 全字段；type-only、content 和 metadata 带关系选择未动态单测，后两者其查询路径共用 relation_filter，无法等同完整查询已经验证 |
| DR 重划 | `reallocation_probe.py` 私有合法稀疏连通二部图 k=3/50/250、N=2k、E=2k。经 sync-index + check 成功；对每图 predecessor anchor 验最大记录 2k−1 时整个事件 blocked、2k 时直接后继与 context 正确，输出通过 | 严格机械领域验证不等于真实决策承接语义成立；每规模单次，不覆盖稠密重划或多分量；无插桩计数 |
| IR 资源 owner | `resource_probe.py` 同一份无边正式报告分别直接引用 0/30/500/2000 个真实普通文件，私有 Git 仓库、公开 sync-index + 全量 check 成功；固定 anchor 的 trace 和空关系筛选 list 成功；`guard_recheck.py` 对 2000 规模复测两次并逐文件守卫 2005 项输入、工具和脚本 | 2000 条为文件和 index 均增加，非纯内核计量；其它样本的脚本只在查询前后守卫 index、资产记录资产 hash，未对每个资源文件做前后完整守卫；共享引用、无效 owner 未动态测 |
| 全量 check / 同步及 mutation | 新建 fixture 的两域公开 sync-index 与全量 check 成功；`mutations/check/index.rs`、`sync/selected_sync`、`stage`、identity、relations、authoring 等处检索到域图入口 | 是 fixture 合法性证据，不代表已逐项动态验这些 mutation、selected check、stage、事务或每种调用路径；相关切面由写入/Git 负责人结算 |

旧合法 fixture 的参数及索引字节：

| fixture | N | width | depth | DR E / bytes | IR E / bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| n32 | 32 | 4 | 4 | 15 / 19652 | 18 / 16160 |
| width40 | 250 | 40 | 8 | 55 / 145142 | 94 / 119890 |
| width200 | 250 | 200 | 8 | 215 / 161302 | 214 / 130570 |

图每条边是来源指向前序；IR 普通关系单个来源至多一条前序，普通宽分支由多个后继指向同一前序。私有 fixture 必须经来源解析、同步和 check；不存在从手工 Unit 数组推断 CLI 可达性的做法。

## 成本地图与判断

- 结构化索引 `parse_index -> build_index -> Definition.validate` 遍历输入和记录字段；不带关系条件的常规查询不额外请求图。带关系条件、trace 或需要全图的操作调用快照 `graph`，`OnceLock` 在同一快照内最多构建一次。常见合法工作包括集合验证、为 E 建出入双邻接、Kahn 拓扑检查及邻接边 UTF-16 排序；排序与输出顺序是契约成本，不自动视为缺陷。不同查询、不同事务阶段重新构造快照不应误称全局复用。
- DR 图验证检查目标归档、拆分/归并形状和重划二部连通分量；trace 的 `decision_events::Events::new` 再从图恢复重划事件分组，前者证明合法、后者构造可共享的原子预算事件：存在复做遍历，但职责不同。IR 图验证资源 owner、关系形状、每边形成时间；其 `investigation_events` 惰性缓存拆分/归并组。两域适配器对事件去重且组成员经 Arc 复用，不能模拟未约束的重复 Unit 并据此声称生产可达。
- 筛选 `relation_filter::from_snapshot` 当前先枚举整个已验证图并复制每条边，再按 anchor/type 过滤，排序匹配 evidence；所以高 N/E 过滤返回少量结果仍具有全图工作。图必须完整验证是契约要求，枚举并克隆所有边是否必要是单独实现取舍，尚未做专门隔离计数。
- trace 逐 BFS 层排序；原子事件涉及直接目标与 context，达到 depth 时产生 frontier；超预算时收集当前未访问事件、剩余方向/层及已发现下一层的 frontier，最后排序和序列化。大 frontier、完整事件及 entries 自带可观输入与输出下界；本次确认语义但未机械计比较或独立预算计算耗时。
- **明确可达的源码工作量风险**：IR `domains/investigation/graph.rs:25-30` 每个资源引用均对 owner 的有序 `Vec` 做线性 `contains`。单 owner 自有 R 条唯一资源，自查的成功元素比较次数依次为 1…R，总计 R(R+1)/2：R=500 为 125250，R=2000 为 2001000。资源 fixture 确已通过来源、同步、完整 check 和图查询；此数是源码与合法输入的推导，不是运行时插桩计数。共享资源进一步乘以引用数，未测。排序不意味着必须用具体某种替代方案；潜在索引或二分的内存、字符排序和复杂度权衡需另审。

## 少样本 wall 和归因边界

- 在单 owner R=2000、N=1、E=0，trace 字节恒为 414；守卫复测两次为 5.62 / 5.49 ms；带关系筛选空结果 list 为 4.95 / 5.51 ms、无图的空 tag list 为 2.00 / 1.92 ms。R=500 原采样 trace 2.49–2.71 ms、无图 list 1.49–1.64 ms。跨调用还有过程启动、字节读取/解析、日期和其他查询成本；两种 list 参数及输出分别相差约 40 字节，不能把差值当纯图成本或证明收益幅度。R=2000 准备 2000 个文件约 0.20 s，sync-index 1.76 s、check 1.84 s；它们还包括文件系统及来源工作。
- DR 重划 k=3/50/250 的受阻 trace 单次分别 1.55/2.08/5.02 ms；完整事件 trace 1.38/2.09/6.37 ms。N、E、index、event、blockedEvent 与 context 输出均变化，不是分离出的重划构建成本。IR/DR 宽归并 trace 不同输出大小见 `trace_results.jsonl`；小于进程、环境和结果变化尺度的差异不作性能排序。
- 这里是有边界的源码推导、单次/少次完整 CLI 样本与语义观察，不报 P95、不等同生产用户规模或跨平台 SLA。快照本身建立两次分量和全量边投影是进一步验证或比较实现的候选，不宣称已证明端到端性能缺陷。

## 证据与后续

`trace_results.jsonl` 保留每次 argv、输出 hash 和字节、耗时；`trace_guards.json` 检查复用 index 与资产前后未变，但这些复用 fixture 的所有 Markdown 未逐个守卫。`ordinary-results.json`、`realloc-*-results.json`、`resource-*-results.json` 中的成功样本保留 argv、退出码、输出字节与 hash 和耗时等摘要，完整成功 stdout 未归档；通过结论来自脚本运行时断言。`resource-2000-guarded.json` 含全文件 hash。脚本失败则保留 failure JSON（无故意删除）；这些脚本是一次性调查探针，不是新增长期测试或发布验收。未对所有新建 fixture 的每个文件做前后守卫，不夸大全量 input proof。若要求独立验证具体热点，可优先在**合法**来源上插桩 owner contains 比较，或测试 R 与共享引用变化；需同时比较 release 原输出及私有插桩构建，区分源码工作量、计数和 wall。其他未测分支应按风险与准备成本另选，不以本切面代表全入口穷举。
