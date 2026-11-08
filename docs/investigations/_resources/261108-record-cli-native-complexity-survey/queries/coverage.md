# 原生记录 CLI：查询与发现切面

## 身份、样本、方法

- 隔离 release：`/workspace/skills/dist/record-cli-perf-261107-main/assets/`；DR/IR 版本均 0.1.0；构建 manifest 的 source SHA-256 `88c5ecaa22b7a42ba660b7c14a3e0c5300c85fb4174c5fc818792b25d976c072`，源码快照不因读取 manifest 而自动得到重新验证。二进制哈希、HEAD、平台、四种 fixture 索引哈希与前后比对见 `environment.json` / `guards.json`。guard 仅覆盖索引和 binary，并不证明全部正文在采样中未变。
- 原 fixture `/workspace/skills/dist/record-benchmarks/perf-261107-main/n{32,250,1200,5000}` 为先前生成的只读记录，两个域同规模。生成器 `tools/record-cli/benchmarks/fixtures.ts` 曾运行旧 CLI sync-index/check；本次只复核其生成逻辑、选中正文和输出，不重跑全集 check，故不声称本轮证明全集健康。全部文档标记 `benchmark`、同时间戳、短文本、低图密度；N32 宽深 4，余 8，边数不随 N 等比增长。候选新 fixture 仅位于本目录 `candidates-{1,32,250}`，均无正式索引、无资源和关系；文件树哈希见 guards。
- `samples.jsonl` 共 290 条，字段 `scenario`、`domain`（`dr` / `ir`）构成入口与场景的可靠检索键，`rep` 为逐次序号，`argv` 为确切参数数组，含完整 stdout/stderr、退出码、哈希、毫秒及 `oracle`。284 条通过；6 条 `list-tag-date` 的 FAIL 为调查者错误地传 date-only，输入被预期之外的参数校验拒绝（每域三次，均保留）；RFC3339 端点修正为 `list-tag-datetime-retry` 两域各三次通过。不是隐藏/补删异常。脚本 `survey.py`、`candidates.py`、`branches.py`、`date_retry.py` 记录生成与各独立断言；脚本设计为新产物目录运行，直接重跑会追加或因既有 fixture 拒绝，不是公共 benchmark。
- N32/250/1200 查询每臂 3 次，N5000 每臂 1 次；候选与额外分支 3 次，参数位置单次。30 秒超时，无预热、无随机化，逐次新进程，收集完整输出，缓存状态未控制；正式排序的首个样本和后续有显著差异。样本完成文件 mtime 2026-11-08 06:25:30 UTC，缺逐次绝对时间；协调期间非严格隔离。不存在 P95、严格冷缓存或平台外推的证据。较大档只测一次，作为数量级观察，不代表分布。
- 独立 oracle 基于 fixture 生成器（日期、状态、路径排序与每十条 marker）、领域查询契约（精确命中数、覆盖/分页和 content 截断）、候选 fixture 内容和直接读取选中文本。列表核对 ID/total/facet 记录数及 tag 计数；metadata 核对 ID/精确计数与 coverage；content 核对 ID/返回与匹配数/完整性和每个命中的预览文本及 UTF-16 range；show 比较完整 Markdown 与实际选中文件；候选核对 ID、readiness、选中正文。不是全字段协议差分；不核对所有时间 facets、warning 和其他复杂预览。

## 按入口覆盖与主要成本

| 域与入口 | 已读主要路径/阶段 | 动态代表与结果 | 未覆盖或交接 |
| --- | --- | --- | --- |
| DR help/version | `src/cli.rs:69-151`, `src/cli/help.rs` | 实际 0.1.0、顶层和 list/search/show/candidates/show-candidate help 已读取；无计时样本 | help 不读取集合；特殊 topic 错误未测 |
| IR help/version | 同上 | 同 DR | 同 DR |
| DR list | `queries/decision.rs:157` → `load::snapshot` → `decision/list.rs:112,181,213` → `facets.rs:31` → filter/sort/page | `n{32,250,1200,5000}-list-{page,empty}`；N32 `dr-list-{active,archived,unaligned}`、`list-tag-datetime-retry`，oracle 全过 | 多 tags、detail、关系筛选和非平凡 facets 未测；图校验交图切面 |
| IR list | `queries/investigation.rs:126` → snapshot → `investigation/list.rs:47,95,122` → facets → select/sort/page | 同上述 N 四档 page/empty 和 N32 RFC3339/tag，oracle 全过 | 多 tags/detail/关系筛选和非平凡 facets 未测；图交接 |
| DR metadata search | `decision.rs:193` → `decision/search.rs` → `decision/metadata.rs:36,74` → `metadata_match.rs:23,45` → `matcher.rs:19,44` | 四档 `metadata-{hit,miss}`，N32 NFKC/all/any/phrase，准确计数/窗口通过 | 关系摘要命中、较长多段及多 tag 未测 |
| IR metadata search | `investigation.rs:168,184` → `investigation/search.rs` → `investigation/metadata.rs:31,72` → 共用 matcher | 同 DR 四档和 N32 四模式通过 | 关系摘要、日期 search 组合未测 |
| DR content search | `decision/content.rs:3,31` → shared `content.rs:37-64,76-105,129-158` → `preview.rs:29-66,74` | 四档 `content-{hit,miss}`；N5000 无命中读全；N32 显式 content limit 按参数拒绝。均按 oracle 通过 | 极长行、预览预算上限、Unicode 截断/多词重叠、源码错误和筛选组合未测；旧报告的特定 Q×R/Q²L 是历史而非此轮发现 |
| IR content search | `investigation/content.rs:3,38` → 同共用扫描与预览 | N32/250/1200 两种命中分布均通过；N5000 两种均在扫描前因 2000 候选预算拒绝（不是成功搜索） | 同 DR，另未测带时间/资源关系的搜索 |
| DR show | `decision/show.rs:11` → selector → `load.rs:48,81` 单文件安全捕获、ID、指纹 | 四档 `show-{id,name}` 与 N32 `show-not-found`：正文/ID/warning oracle 通过 | stale、无效 UTF-8、安全路径/重名未测 |
| IR show | `investigation/show.rs:14` → selector → 同 load；当前正文 ID 可容忍单 BOM | 同 DR | BOM、stale、安全错误等未测 |
| DR candidates | `candidate_discovery.rs:82` → `candidate_discovery/decision.rs:3,29,91` → `decision/candidates.rs:32,95` | 已发布零候选 N32/1200/5000；无索引独立候选 C1/32/250 `candidate-*-all` 均通过 | 无损坏候选、重名、依赖关系和 archive 异常；不证明生产目录健康 |
| IR candidates | `candidate_discovery/investigation.rs:3,35` → `investigation/candidates.rs:35,71,151` | 零候选 N32/1200/5000；无索引 C1/32/250 all/readiness 均通过 | 资源/owner 交叉引用、失效候选与 Git ignore 未测 |
| DR show-candidate | 同 DR 全集合 discovery，再 selector，再对所选解析 readiness | C1/32/250 `candidate-*-show-{id,name}` 三次均通过；比较完整正文 | 大候选正文、依赖/非法 selector 未测 |
| IR show-candidate | 同 IR 全集合 discovery，再 selector、选中正文 readiness 和资源检查 | C1/32/250 同上，三次均通过 | 资源 owner 交叉引用、非法目标未测 |
| 两域 check | `queries/decision.rs:146`, `investigation.rs:114` → `mutations/check` | 动态不在本切面 | 动态由写入/Git 切面处理；不能从其他查询推断全量检查 |
| 两域关系筛选/trace | `relation_filter.rs` 和 `QuerySnapshot::graph` | 本切面仅读到交接 | 图切面负责；不能从无关系过滤路径外推 |

每域的参数组由 `src/cli/arguments/query/arguments.rs`、`build.rs` 校验；参数错误/领域错误分别 exit 2/1，成功 JSON envelope version 2。`src/cli/output.rs:3-30` 先构建完整序列化字符串后写 stdout，非 JSON 路径用 pretty JSON，本轮不测非 JSON renderer。

## 成本解释及观察（不是自动判缺陷）

- **每次进程的索引底价**：`queries/load.rs:7-25` 捕获完整索引；`index.rs:60-75,124-144` 先扫描未配对 surrogate，再 JSON Value、typed 反序列化和领域校验。完整索引输入本身要求读入相应字节；中间 Value/多遍扫描和额外内存是实现可观察的附加阶段，未量化单阶段成本，不凭整进程曲线判断可消除比例。selector 对日期 ID 走 BTreeMap 查找，名称扫描 N 并保存所有同名候选，见 `domains/mod.rs:184-213`；本轮单 selector 并非历史多 selector K×N 的复测。
- **列表**：facets 对全量解析时间、逐条去重 tags、汇总并排序不同 tags/month；符合不受筛选影响的 facet 契约。筛选记录后按时间+ID 排序，再分页：N 级扫描、M 个结果排序、P 输出不可混为 P 级查询。N1200 页面 DR 8.02/8.48/8.26ms、空页 8.31/8.03/7.88ms；IR 页面 6.42/6.25/6.62ms、空页 6.27/6.28/6.80ms。即使空页也须完整索引/facets；不能由相似时间证明任一阶段主导。
- **metadata**：两域先收集并按来源排序全部 N 条，逐条过滤后逐 segment NFKC/小写/空白规范化并匹配；精确命中数要求扫描筛选集合，即使 limit=2 也只限制投影/输出。N5000 DR 命中 37.40ms、未命中 37.49ms；IR 32.86/30.05ms（每个仅一次）。逐段字符串分配及先排序再过滤为源码事实，是否值得优化须另比较语义、输入分布和真实收益。
- **content**：先排序已选来源，实际读取 F 文件，安全捕获/严格 UTF-8/身份验证与文本扫描均随访问字节增长；命中上限后仍扫描直到第一个额外命中以证明截断，返回预览有额外字符/匹配预算。N1200 无命中 DR 233.73/32.42/32.21ms，IR 209.95/24.85/24.38ms；同 fixture 命中上限 DR 50.52/11.33/11.83ms，IR 12.30/7.31/6.86ms（IR limit 2，DR 固定 20，故不跨域比较）。N5000 DR 无命中单次 925.72ms；波动明显、未做缓存/IO 阶段测量，不能声称变慢原因即冷缓存或磁盘。IR N5000 21.65/23.24ms 只是预算拒绝，不能与成功搜索比较。
- **候选**：`show-candidate` 无论 ID/name 都先枚举集合并捕获所有未发布候选，按身份构造 registry，再对单目标做完整 scaffold/readiness。C1 DR ID 1.94/2.14/1.93ms，C250 5.79/5.60/5.74ms；IR C1 1.50/1.84/2.21ms、C250 5.20/5.01/5.23ms。C250 list 全量返回 DR 7.88/7.43/7.13ms、IR 6.83/6.61/7.10ms。C 数量/输入字节/枚举及创建输出随之变化，这不是隔离因果基准；源码已确证全集合发现，未证明不必要：需要全局身份/歧义/安全事实。没有资源、关系及已发布混合候选的规律不可外推。
- **选择与停止**：先按所有入口、合法分支覆盖，再选择 N 与 hit/none、early-stop、页面/空页、ID/name、候选数量的对照；控制统一页宽、marker、短文本和状态范围，保留输出和预算拒绝。候选扩至 250 即能与发现代码对应，N5000 无命中一次已呈明显较高耗时和缓存波动，不再机械扩大或重复高成本；无法由这些短样本断言复杂度指数或需要生产优化。

## 额外接口一致性观察（非性能结论）

两域 `global-json-before-command` 原始样本均为 `--root ROOT --json list`，exit 2、JSON error `unsupported query command: --json`；实际成功写法为 `--root ROOT list --json`，本轮几乎所有成功样本可复核。顶层 help 将 `--json` 列为 Global options，但命令 help 给的是 `command ... --json`；`src/cli.rs:69-111` 只将位置选项 `--root`/领域目录识别为可前置全局参数，未将 `--json` 纳入。说明名称有潜在歧义，不单凭“Global”证明该排列被承诺；本轮不扩为兼容性审计。
