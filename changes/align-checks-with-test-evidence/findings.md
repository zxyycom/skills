# Findings 处置与验证

本文件是本 Change 的临时追踪表；状态均为计划处置，非已实施或已通过。任务勾选前补充实际改动、最终后继和精确验证结果。来源为审计目录 `.log/vibe-check/audits/test-design-census-20261024-wx9KzT/` 的 A–F report/tests/checks、summary、review-checks（RC）与 review-tests（R/W/P/E-R）；原始文件可供当前任务复核，不进入长期 owner。旧审计路径数和节点数不作验收目标。

处置含义：**采用**＝进入实施；**收窄**＝保留有效责任，改正过强承诺或限定改法；**保留**＝不削弱当前证据；**待核**＝先取得指定事实再决定，不预设有 Bug；**不实施**＝独立复核已撤回或没有当前契约依据。

## Check 接入、责任与输入

| ID／来源 | 处置及理由 | 任务／目标证据 |
| --- | --- | --- |
| RC1 / A1 | 采用：environment 真实生成 Change Plan 短命令 smoke 迁适当责任或补分发闭包＋统一 provider，不能只补一种。 | 1.1、1.3；分发 bytes 单改激活、provider 失败不消费。 |
| RC2 / B-01 | 采用：双域生成 worker 归明确分发责任，补两域输入及 provider；保留实际 worker 启动。 | 1.1–1.2；两域生成闭包真实 Node。 |
| RC3 / C1 | 采用：IR index、transaction 实际 CLI，以及 transaction 顶层 stage 加载闭合；可迁 CLI 场景。 | 1.1；两 Check 独立激活与真实入口。 |
| RC4 / F-01 | 采用：typecheck 纳入实际 TS program 分发输入，先保守充分；format 不一起扩。 | 1.1；传递分发 TS 单改使本项失效。 |
| RC5 / F-02 | 采用：validator 既有输入已含生成树，补统一 provider。 | 1.1；生成不通过时 consumer 不执行。 |
| RC6 / D-C2 | 采用：Test Evidence public-boundary 补既有 provider，非已证文件输入遗漏。 | 1.1；真实分发入口与 provider 传播。 |
| RC7 / E-1 | 采用：LJ 两份生成迁移 SQL 的消费迁正确责任或补 provider。 | 1.1；生成 SQL 一致性及消费顺序。 |
| A/B/C/D/E/F 名称与归位 | 采用：environment、Gate test、DR source CLI＋分发、TG CLI、TE项目覆盖、全 skill 生成、LJ日志统计迁移、Novel历史事务、CP Draft/Git边界显示实责；允许拆合，单纯显示名不改稳定身份。 | 1.3；当前 catalog／精确命令／聚合入口一致。 |
| A gate-tests / RC限定 | 收窄：裁不消费 helper/fixture 字节，但叶子 access／存在性／删除事实仍是输入；不能表达更小身份时保守保留。 | 1.4；删除 leaf 拒绝、无关改动不扩或记录保守理由。 |
| B/C recordOperationInputs | 采用：共同运行时与独立 reader/worker/transaction 测试消费分开，不执行该测试的现状 CLI 不订阅其测试 bytes。 | 1.4；实际消费者激活、非消费者不误带入。 |
| D/E domainRuntimeInputs | 采用：测试归位后核 scripts／整域 tools/skills/docs 宽订阅；尊重 barrel export-from 顶层加载，不按名字或 sourceFiles 自动裁剪。 | 1.4；相关／不相关、ignored、rename、漂移回归。 |
| lint 分发 TS / RC撤回1 | 待核：锁定版本 type-aware 实际读取，不能从 typecheck 直接推断。 | 0.2、1.4；精确访问／程序证据后定输入。 |
| formatter / RC撤回2 | 不实施“跟 typecheck 扩 skills/MTS”：当前是独立政策，只修独立预期。 | 1.5；现行 scripts TS/JS＋tools TS范围锚点。 |
| IR search-output / RC撤回3 | 不实施 index/transaction/collection 全加 renderer；仅成功 CLI search lazy 消费，现对应责任已订阅。 | 0.2、1.4；真实调用再判断。 |
| sourceFiles / RC撤回4 | 不实施自动补齐全部候选；包含 lazy/type-only 高估及 export-from 低估。 | 0.2；按不同运行／类型边界核闭包。 |
| DR query / RC撤回5 | 不实施加生成 provider；真实生成 search-info 已在 public-distribution。 | 1.3；归位后仍核实际 consumer。 |
| portable-build / RC撤回7 | 保留隔离 checkout 自建临时制品，不无差别加当前生成 provider。 | 1.8；真实构建输入与路径可复现。 |
| canonical / RC范围澄清 | 不新增 noncanonical 硬门槛；index info 成功范围如实解释，不等同领域校验重复。 | 1.14；长期 owner不夸大验收。 |
| POSIX 工具 / RC限定 | 收窄为受信宿主边界核对，不擅散列所有 utilities／扩全 Gate 环境／加质量 Gate。 | 0.2、1.14；必要有限事实或保守边界。 |
| 新增 image/video / 当前 owner | 保留当前新 Check、Linux release 和同 revision Windows 视频源码／同次 zip 验收。 | 2.5–2.6；不得沿用64数量或路径跳过。 |

## 测试设计处置

| ID／来源 | 处置及理由 | 任务／目标证据 |
| --- | --- | --- |
| A2 / R7 | 收窄：真实并发不等于命中 CAS；稳定 seam 可用则有界握手，否则准确收窄 Case。 | 1.5；实际交错命中或明确证明边界。 |
| A3 / W3 | 待核后精简：查精确上游容量契约／兼容风险，保留项目预算、完整选集、小型消费；不放宽安全上限。 | 1.5；独立配置及项目集成。 |
| A4 / R6 | 采用：format scripts/tools 范围独立预期；生产常量仅当接线预期使用。 | 1.5；覆盖退化能失败，不重跑全 formatter 证明 glob。 |
| A逐节点环境／名称 | 采用：SCC零安装要捕获安装调用；receipt failed、fallback selects非executes、every代表集、删增非rename、Oxc文件/schema/policy、semantic少数接入边界如实命名。 | 1.3、1.5；必要观察存在，名称不自动扩产品。 |
| B-02 / C2 / 复核共同事务 | 采用：十对相同无参helper只在共同owner留一份；额外共同verification/plan/text/acquisition节点归位，不误删；真实DR/IR adapter各保留。 | 1.2；逐helper后继、唯一注册及域接线。 |
| B-03 / R1 | 采用：删除索引以独立 extensionless ID 查不存在，文件删除与其他成员仍断言。 | 1.6；残留ID反例能失败。 |
| B-04 / W4 | 采用：双向锁等待局部上界、finally释放结算；实际umask同步child加timeout。不能称已复现永久挂死。 | 1.6、1.11；失去目标事件仍有诊断并收束。 |
| B-05 / R2 | 收窄：显式sync后的publish不叫activation reconcile；duplicate/outside参数拒绝不叫missing/pending不变。 | 1.3、1.6；既有stage后继保留，不重复建仓。 |
| B-06 / C4 / F prepared / W3 | 收窄：Map.keys、relations.map、Array iterator、Date.parse探针不能锁算法；保留图准备一次、旧新snapshot隔离、reader不重验、真实fresh及阶段读取。精确进程／JSON.parse计数只在owner确需时保留其内部优化边界。 | 1.6–1.7、1.10；稳定parser／validator／资源观察＋独立结果，不把计数当安全。 |
| B-07 | 采用：1001分页保留；filter intersections 用已有小矩阵后继或独立干扰补缺，不能全同数据声称全过滤。 | 1.6；每个claim有区分性反例／准确Case。 |
| B-08 | 采用：index-maintenance和activation/archive按可独立归因意图拆原生节点，复用准备但不重复大流程。 | 1.6；runner可单选、Case意图连续。 |
| B-09 | 采用：UTC日期固定Date独立日历表；集成不把生产helper生成预期当日期正确证明，控制跨午夜。 | 1.6；offset／月年／闰日边界。 |
| C3 / R3 | 收窄或补必要观察：source CLI非distributed；stage资源需实际修改＋pending bytes；成功终态非独立atomicity；index-only needle、合法source-group与歧义名称按实际后继。 | 1.3、1.7；保留当前搜索／恢复／分组责任。 |
| C4 / R4 | 采用：默认与显式content相等另加独立正文source/preview，metadata保持明确差异。 | 1.7；两端同错被拒绝。 |
| C4 / R5 | 采用：discard恢复比较报告／资源完整旧bytes，mode按该恢复契约；保留具体错误和index。 | 1.7；截断/错内容不能通过。 |
| C formalDrift / 独立闭合 | 采用更正：删除失效拒绝承诺或写成未选formal正文不阻断成功；candidate/index拒绝继续保留，外层明确writer与错误。 | 1.7；不为旧测试扩大生产读取。 |
| C细项数据与状态观察 | 采用：UTF-16排序用区分数据；259目标去重缩到乱序/重复/type/source代表；resource warning精确路径、trace闭合集独立成员、stage bytes/删除表示、rename formedAt/资源bytes、unrelated字段与cleanup提交bytes均在原节点补足或准确收窄。 | 1.7；下方逐节点表逐项回填。 |
| C复合／重复／阶段 | 采用：candidate/relations/publish按独立意图拆；重复分组拒绝与history-prefix先核具体保留后继再归并；phase/read承诺用命中／外层计数或收窄；并发finally收束。 | 1.7、1.11；不因建议删除不同责任。 |
| D-T1 / R10 | 采用：删无公开契约的私有声明全名单；保留公开入口、无泄漏、引用可解、真实类型consumer、Schema与生成头；独立意图可拆。 | 1.8；合理内部拆分不误报。 |
| D-T2 | 采用：task字典逆序；help非batch执行、未捕获stderr非empty、append非inode替换、单故障非priority、revision非所有watermarks、import非全局无副作用，准确命名或补必要观察。 | 1.3、1.8；不为名字盲补全矩阵。 |
| D-T3 / R11 | 采用：12000 extra普通usage缩小，已有source CLI承接纯矩阵保留代表Node；ancestorIds栈安全单列并论证规模。 | 1.8；真实功能阈值/Node深链保留。 |
| D逐节点拆分与产物边界 | 采用：schema错误协议、lease意图、core-stage、Case非法成员各独立归因；禁止安装产物检查核目录身份或收窄tree承诺。 | 1.8；实际原生入口与准确产物责任。 |
| D-T4 / R11 / W2 | 采用资源回收；撤回“kill后立即监听已证正常路径竞态”。child失败finally仍须等待退出，TE临时目录统一回收。 | 1.11；异常路径child／目录已退出。 |
| D-T5 | 收窄：差分只证接线，inode不证零注册，两个同环境checkout不证optional peer独立；改Proves或既有计数／对照，不造框架。 | 1.8；独立语义预期继续保留。 |
| E-R1 | 采用有界注入命中及提交窗口证据；终态readlink不独立证明先验／提交间swap，无seam准确收窄。 | 1.9；8MiB不替代事件。 |
| E-R2 | 采用：健康凭据＋具体图片拒绝；如承诺先于credential/assets/HTTP，以外部计数观察零调用。 | 1.9；缺key不能掩盖扫描退化。 |
| E-R3 | 采用：patch拒绝核SSH调用零，沿用离线fixture。 | 1.9；错误码正确但已发送不能通过。 |
| E-R4 | 采用：独立crypto binary/empty SHA、bytes与空目标/get；保留binary roundtrip。 | 1.9；undefined或双端同错失败。 |
| E-R5 | 采用：首次apply比较完整原unrelated TOML bytes，不只二次幂等／单注释。 | 1.9；既有切片回归保留。 |
| E-R6 | 采用：BOM rollback第3writer故障命中在外层明确，保留原文与成功snapshot。 | 1.9；早期通用失败不能冒充目标阶段。 |
| E-R7 / E-R8 | 收窄new-id为可用非普遍唯一、CP刷新为不受旧distance阻断或用既有trace证零查询；不加随机统计或更大输入。 | 1.3、1.9；真实ID/基线接线保留。 |
| E fixture附加 | 采用：CP Git env隔离，initializer免无关Git，LJ真实Node/HTTP child局部deadline/finally收束。 | 1.11；必要patch、历史、WAL/SIGKILL保留。 |
| F-03 / R8 | 采用：仅Alpha换行beta的all/phrase文件；取消在display耗尽后实际触发；bytes drift改现存member；prefix binary与坏尾观察或准确收窄。 | 1.10；错误准入／阶段／接线可区分。 |
| F-04 / R9 | 采用纯path与mock git.raw轻量准备；mode重复只能在保留双向错误模型、index全bytes、零写和范围外保护后合并，不能直接删。 | 1.10；真实Git其他边界保留。 |
| F逐节点名称／API | 采用：protocol sources成功/拒绝、sourceRevision空字段、domain跳过projection、prewrite非已写后恢复按观察补或收窄；updater去export写法锁，真实tsgo consumer保留。 | 1.3、1.10；合法实现替换容忍。 |
| F orphan validate | 采用：健康结构仅坏link与坏结构分开，接既有test入口＋Case；空description不导致早退。 | 1.12；删skip目标失败且无无关配置掩盖。 |
| P1 updater --check | 采用：确有更新分支记录零zip请求和目录成员/bytes不变；release/manifest请求合法。 | 1.10；无网络/安装扩展。 |
| P2 publisher | 采用：fake mutation zip upload故障与命中，随后manifest/stale delete/edit均缺席；已有view not-found和冲突证据保留。 | 1.10；本地替身，不远端写。 |
| P3 性能CLI | 采用：安全total＋受控slow native checkDurations，检查样本／具体预算及exit；不重复政策矩阵。 | 1.5；丢durations不能同样泛失败通过。 |
| P4 catalog解析 | 采用：用已有语法边界识别真实import statement或明确受限承诺；注释不当leaf，合法静态import不漏。 | 1.5；不造全仓索引。 |
| W1 recover callback | 不实施“内部assert被catch即失效”；当前外层committed=true足以拒绝恢复分支，外计数可选非必改。 | 2.1；与formalDrift不同，不泛化。 |
| 保留规模与真实边界 | 保留1001分页/1000worker、Node深链、生产卡数体积深度、256MiB blob预算、权限/锁/安装恢复、双向mode、真实Git pending/HEAD/CAS；不以大、上游或耗时作唯一删除理由。 | 0.3、2.1；具体后继不能互指待删项。 |
| Case／snapshot / RC撤回6 | 采用同步而非质量代替：Case全覆盖不证明测试通过或断言质量；静态清单不证明runner发现执行。 | 1.13、2.2；两类证据分别取得。 |

## 逐节点追踪索引

下表列出 A–F tests 中非普通保留项，包含额外保留边界。编号取原数组位置（从1开始），文件＋完整名称是回查键；主表决定处置边界，不能直接把原 verdict 当实施命令。每行实施后追加最终入口／Case／命令结果或明确收窄依据。正常保留项按原审计记录保留，若实施触及仍须重审。

### A 切面

| 来源行 | 最小入口（文件／名称） | 计划处置／任务 | 实施结果／证据 |
| --- | --- | --- | --- |
| A-tests[2] | `scripts/auto-push.test.ts`：post-commit auto-push serializes concurrent hourly attempts | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[7] | `scripts/environment-check.test.ts`：environment requires exact SCC without installing it | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[11] | `scripts/environment-commands.test.ts`：repository short command change-plan invokes its owned skill CLI | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[21] | `scripts/lib/vibe-gate/impact-failures.test.ts`：incremental Gate rejects corrupt and failed receipts | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[55] | `scripts/lib/vibe-gate/impact-release.test.ts`：non-repository fallback executes the complete base catalog | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[56] | `scripts/lib/vibe-gate/impact-routing.test.ts`：incremental Gate invalidates Novel Cards consumers for every shared and distributed input | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[62] | `scripts/lib/vibe-gate/impact-routing.test.ts`：incremental Gate proves content across dirty clean commits deletion and rename | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[70] | `scripts/validators/project-config.test.ts`：project package script validation preserves maintenance CLI delegations and the authoritative Vibe gate | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[71] | `scripts/validators/project-config.test.ts`：format scripts cover repository automation and distributable tool sources | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[74] | `scripts/validators/project-config.test.ts`：project configuration requires Oxc configuration files | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |
| A-tests[94] | `scripts/vibe-check-native-selection.test.ts`：project secret detection preserves complete coverage within its bounded file capacity | 待核精确上游容量契约后最小化，安全上限不变；0.2、1.5 | 待实施 |
| A-tests[110] | `scripts/vibe-check-semantic-catalog.test.ts`：semantic commands match package manifests and retain dedicated integration boundaries | 按A发现补观察／准确名称；1.3、1.5 | 待实施 |

### B 切面

| 来源行 | 最小入口（文件／名称） | 计划处置／任务 | 实施结果／证据 |
| --- | --- | --- | --- |
| B-tests[52] | `tools/decision-records/tests/acquisition-safety.test.ts`：Record source reads independently prove canonical namespaces without repeated root resolutions | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[53] | `tools/decision-records/tests/acquisition-safety.test.ts`：Record source reads reject same-inode parent replacement and in-read byte drift | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[70] | `tools/decision-records/tests/lazy-relation-graph/context.test.ts`：Decision record snapshots build lazily once across validation trace and adjacent relation filters | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[71] | `tools/decision-records/tests/lazy-relation-graph/context.test.ts`：Decision freshly loaded snapshots isolate changed relations while earlier snapshots retain their graph | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[74] | `tools/decision-records/tests/lazy-relation-graph/queries.test.ts`：Decision query graph reuse preserves option and index failure priority and complete relation diagnostics | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[75] | `tools/decision-records/tests/lazy-relation-graph/queries.test.ts`：Decision content search reuses the published graph while reading current text | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[85] | `tools/decision-records/tests/index-maintenance/index-maintenance-01.test.ts`：index maintenance detects drift and synchronizes canonical decision states | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[90] | `tools/decision-records/tests/query-loaded-snapshot.test.ts`：Decision list preserves filter intersections facets and relation evidence in a large published snapshot | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[107] | `tools/decision-records/tests/relation-filter-complexity.test.ts`：Decision type-only relation evidence appends linearly and keeps tuple deduplication and code-unit order | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[135] | `tools/decision-records/tests/activation-archive.test.ts`：publication and archive transitions preserve content and index atomicity | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[150] | `tools/decision-records/tests/candidate-lifecycle/candidate-lifecycle-05.test.ts`：activation reconciles unindexed established records before committing a candidate | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[182] | `tools/decision-records/tests/localize-record-operations/identity.test.ts`：Decision canonical creation allows legacy and cross-date names while preserving exact identity through publication | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[208] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared transaction verifies bytes mode and commit before success | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[209] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared transaction preflight avoids locks and unchanged verifies fresh facts | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[210] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared transaction restores only actual precommit writes | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[211] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared transaction protects later bytes inode mode and unwritten members | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[212] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared transaction retains committed verification and cleanup failures separately | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[213] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared transaction recognizes a rejected writer that published the index | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[214] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared candidate commit preserves creation and distinguishes cleanup only | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[215] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared transaction never overwrites a recreated old path | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[216] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision actual domain adapter satisfies the shared committed writer rejection contract | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[217] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared recovery never claims a replacement inode between writer close and readback | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[218] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared native creation binds permission verification and recovery to its actual handle | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| B-tests[219] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared verification acquires overlapping unchanged protection once in each independent phase | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[220] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared verification never reuses different namespace or expected snapshot facts | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[221] | `tools/decision-records/tests/record-shared-transactions.test.ts`：Decision shared postwrite verification rejects later bytes mode and inode despite overlapping fresh protection | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[222] | `tools/decision-records/tests/record-shared-transactions.test.ts`：shared plan normalizes only unchanged proposals while retaining order index and conflicting protection | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[223] | `tools/decision-records/tests/record-shared-transactions.test.ts`：shared fresh text acquisition binds roots isolates mutable proofs and rejects unsafe invalid or missing sources | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[254] | `tools/decision-records/tests/transaction-recovery/transaction-recovery-03.test.ts`：sync-index fails while a decision transaction holds the collection lock | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[255] | `tools/decision-records/tests/transaction-recovery/transaction-recovery-03.test.ts`：decision transaction fails while sync-index holds the collection lock | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[256] | `tools/decision-records/tests/transaction-creation-modes.test.ts`：Decision native creation preserves umask for candidates and first formal indexes | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[303] | `tools/record-operations/tests/reader-worker-runtime.test.ts`：record generated skill installations include executable local worker closures | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[326] | `tools/decision-records/tests/stage/stage-03.test.ts`：stage rejects invalid duplicate and missing paths without changing the pending snapshot | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[337] | `tools/decision-records/tests/stage-index-payload.test.ts`：Decision stage index acquires one preparation pending payload then independent locked and readback payloads | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[338] | `tools/decision-records/tests/stage-index-payload.test.ts`：Decision stage reuses same-call index parses after independent actual W and P payload reads | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[339] | `tools/decision-records/tests/stage-index-payload.test.ts`：Decision stage reparses changed actual W bytes even when decoded projection is identical | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |
| B-tests[341] | `tools/decision-records/tests/stage/locator-index.test.ts`：Decision stage all reuses its verified locator index without reparsing the expanded snapshot | 按B发现归位／补观察／拆意图；1.2、1.6 | 待实施 |

### C 切面

| 来源行 | 最小入口（文件／名称） | 计划处置／任务 | 实施结果／证据 |
| --- | --- | --- | --- |
| C-tests[21] | `tools/investigation-report/tests/candidate-operations.test.ts`：Investigation candidate operations preserve drafting selection discovery and recovery boundaries | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[34] | `tools/investigation-report/tests/cli-boundaries.test.ts`：CLI rejects repeated single-value options before any collection access or candidate creation | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[42] | `tools/investigation-report/tests/cli-generated.test.ts`：CLI set-relations rejects relations that do not follow a source | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[45] | `tools/investigation-report/tests/cli-generated.test.ts`：CLI set-relations scopes summaries to complete source groups | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[65] | `tools/investigation-report/tests/cli-relation-input.test.ts`：set-relations parses complete source groups and rejects ambiguous grouping | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[68] | `tools/investigation-report/tests/cli-search-defaults.test.ts`：CLI search defaults to content and distinguishes metadata output | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[69] | `tools/investigation-report/tests/cli-search-summary.test.ts`：distributed investigation search prints exact metadata and lower-bound content summaries on proper channels | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[101] | `tools/investigation-report/tests/index-relations.test.ts`：list and search combine direct relation selectors with existing query boundaries | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[125] | `tools/investigation-report/tests/relation-context.test.ts`：investigation plain list and metadata search build no relation graph | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[130] | `tools/investigation-report/tests/relation-dedup.test.ts`：investigation type-only evidence deduplicates merge triples and keeps first summaries | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[139] | `tools/investigation-report/tests/relation-review.test.ts`：publish release cleanup failure preserves the committed result without a successful review | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[151] | `tools/investigation-report/tests/resources.test.ts`：referenced missing resources are errors and unreferenced visible resources are warnings | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[162] | `tools/investigation-report/tests/resources.test.ts`：unreferenced resource members produce warnings without blocking report checks | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[167] | `tools/investigation-report/tests/result-integrity.test.ts`：investigation trace refuses a missing target and returns exact closed members for a valid graph | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[218] | `tools/investigation-report/tests/staging-domain.test.ts`：stage --scope domain writes the report and its complete owner resource tree | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[223] | `tools/investigation-report/tests/staging-domain.test.ts`：stage --scope all writes the index projection, report, and owner tree atomically | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[225] | `tools/investigation-report/tests/staging-index-payload.test.ts`：stage index preserves unselected partial pending mode and staged deletion | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[242] | `tools/investigation-report/tests/staging-pending-deletion.test.ts`：stage all preserves a pure dependency pending deletion without reading its body | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[293] | `tools/investigation-report/tests/discard-phase-verification.test.ts`：Investigation discard shared fresh rejects source and membership drift without removing the source | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[297] | `tools/investigation-report/tests/discard-recovery.test.ts`：discard restores report resources and index when index publication fails | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[305] | `tools/investigation-report/tests/discard.test.ts`：discard rechecks owner resource membership drift before publishing | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[308] | `tools/investigation-report/tests/discard.test.ts`：sync-index rejects a concurrent rebuild while discard owns the collection | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[309] | `tools/investigation-report/tests/discard.test.ts`：discard identifies a formal report, a missing target, and ambiguous names | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[312] | `tools/investigation-report/tests/execution-entry-contract.test.ts`：Investigation unified discard classifies and prepares under one lock for formal and candidate targets | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[321] | `tools/investigation-report/tests/publish.test.ts`：publish preserves candidate resources and rolls renamed candidates back when index publication fails | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[322] | `tools/investigation-report/tests/publish.test.ts`：publish rechecks candidate, formal source, and index drift before changing files | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[329] | `tools/investigation-report/tests/rename-phase-verification.test.ts`：Investigation rename shares hook fresh source and index observations without crossing postwrite phases | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[336] | `tools/investigation-report/tests/rename-validation.test.ts`：Investigation candidate rename has a read-only preflight and retains formedAt date | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[342] | `tools/investigation-report/tests/rename.test.ts`：Investigation rename migrates a legacy ID while retaining an unchanged source path | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[346] | `tools/investigation-report/tests/strict-preparation.test.ts`：strict rename postwrite reads only actual rewritten sources and the expected index | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[350] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared transaction verifies bytes mode and commit before success | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[351] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared transaction preflight avoids locks and unchanged verifies fresh facts | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[352] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared transaction restores only actual precommit writes | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[353] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared transaction protects later bytes inode mode and unwritten members | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[354] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared transaction retains committed verification and cleanup failures separately | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[355] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared transaction recognizes a rejected writer that published the index | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[356] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared candidate commit preserves creation and distinguishes cleanup only | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[357] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared transaction never overwrites a recreated old path | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[359] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared recovery never claims a replacement inode between writer close and readback | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[360] | `tools/investigation-report/tests/transaction-boundaries.test.ts`：Investigation shared native creation binds permission verification and recovery to its actual handle | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |
| C-tests[364] | `tools/investigation-report/tests/transaction-domain-boundaries.test.ts`：Investigation rename fresh proof rejects resource mode and inode drift without undoing the external winner | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[371] | `tools/investigation-report/tests/transaction-file-writer.test.ts`：Investigation discard preserves empty cyclic and unknown writer failure facts | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[378] | `tools/investigation-report/tests/transaction-recovery.test.ts`：set-relations is idempotent and leaves unrelated report fields unchanged | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[380] | `tools/investigation-report/tests/transaction-recovery.test.ts`：set-relations release cleanup failure preserves committed bytes without a successful review | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[383] | `tools/investigation-report/tests/transaction-sync.test.ts`：set-relations atomically applies multi-source replacements and explicit clears | 按C发现补观察／准确名称／拆意图；1.7 | 待实施 |
| C-tests[390] | `tools/investigation-report/tests/history-prefix-contract.test.ts`：history identity accepts cr first-three-line source prefixes | 先明确唯一保留后继再去重；1.2（共同事务）或1.7（其余） | 待实施 |

### D 切面

| 来源行 | 最小入口（文件／名称） | 计划处置／任务 | 实施结果／证据 |
| --- | --- | --- | --- |
| D-tests[1] | `tools/task-graph/tests/graph-projection.test.ts`：graph validation rejects cycles and dangling references | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[7] | `tools/task-graph/tests/schema-index.test.ts`：strict schema rejects unknown fields, illegal state unions, and duplicate leases | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[8] | `tools/task-graph/tests/schema-index.test.ts`：canonical serialization keeps root task identity, sorting, LF, and round trip | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[17] | `tools/task-graph/tests/lifecycle-lease.test.ts`：lease lifecycle enforces duration, renewal, expiry, and explicit claim recovery | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[22] | `tools/task-graph/tests/task-removal.test.ts`：CLI exposes batch task removal and no scope command | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[33] | `tools/task-graph/tests/native-store.test.ts`：operating system releases a child process native lock without stale metadata recovery | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[38] | `tools/task-graph/tests/cli-help.test.ts`：CLI usage failures use the JSON protocol | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[42] | `tools/task-graph/tests/cli-failures.test.ts`：CLI maps path failures to JSON exit one with empty stderr | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[80] | `tools/task-graph/tests/staging-conflicts.test.ts`：rejects regressing workspace watermarks without changing pending content | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[86] | `tools/task-graph/tests/generated-artifacts.test.ts`：distributed task-graph tree contains no native runtime or install artifacts | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[87] | `tools/task-graph/tests/generated-artifacts-distribution.test.ts`：generated distribution matches current source API, schema bytes, and metadata | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[88] | `tools/task-graph/tests/portable-build.test.ts`：generated task graph artifacts ignore checkout path and ambient optional peers | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[95] | `tools/test-evidence/tests/core-stage.test.ts`：stage supports bootstrap, unchanged selections, missing IDs, and an empty target | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[97] | `tools/test-evidence/tests/core-query.test.ts`：show detects source replacement and search reads authoritative Case text | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[99] | `tools/test-evidence/tests/core-query.test.ts`：Case validation rejects a duplicate ID | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[111] | `tools/test-evidence/tests/core-cli-search.test.ts`：snapshot failure priorities reject malformed input, source mismatch, and unknown selection | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[119] | `tools/test-evidence/tests/public-boundary.test.ts`：distributed TS imports in Node without side effects and exposes only the current public API | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[122] | `tools/test-evidence/tests/public-boundary.test.ts`：public CLI usage errors and API invalid options retain separate structured failures | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |
| D-tests[140] | `scripts/test-evidence/check.test.ts`：project check rejects a registered test without a Case | 按D发现补观察／轻量化／准确意图；1.8、1.11 | 待实施 |

### E 切面

| 来源行 | 最小入口（文件／名称） | 计划处置／任务 | 实施结果／证据 |
| --- | --- | --- | --- |
| E-tests[2] | `tools/mcpshell-workspace-bridge/tests/initializer.test.ts`：initializer applies idempotently and preserves unrelated TOML bytes | 按E发现补观察／准确名称；1.9、1.11 | 待实施 |
| E-tests[13] | `tools/mcpshell-workspace-bridge/tests/runtime-containment.test.ts`：workspace put binds its final commit to the verified parent during a symlink swap | 按E发现补观察／准确名称；1.9、1.11 | 待实施 |
| E-tests[22] | `tools/mcpshell-workspace-bridge/tests/runtime-transfer.test.ts`：workspace put and get preserve binary and empty-file bytes with both endpoint hashes | 按E发现补观察／准确名称；1.9、1.11 | 待实施 |
| E-tests[26] | `tools/mcpshell-workspace-bridge/tests/runtime-patch.test.ts`：workspace apply patch rejects escape paths and oversized text before SSH | 按E发现补观察／准确名称；1.9、1.11 | 待实施 |
| E-tests[35] | `tools/mcpshell-workspace-bridge/tests/localhost-ssh-integration.test.ts`：localhost OpenSSH runs all generated workspace operations against isolated roots | 保留必要规模／真实边界；0.3、2.1 | 待实施 |
| E-tests[36] | `tools/mcpshell-workspace-bridge/tests/mcpshell-integration.test.ts`：MCPShell stdio exposes the generated fixed-root tools and one read-only shell call | 保留必要规模／真实边界；0.3、2.1 | 待实施 |
| E-tests[51] | `tools/novel-cards/tests/chapters.test.ts`：renaming and renumbering chapters preserve stable IDs with a usable unique ID generator | 按E发现补观察／准确名称；1.9、1.11 | 待实施 |
| E-tests[66] | `tools/novel-cards/tests/transactions.test.ts`：UTF-8 BOM cards retain original bytes through snapshot and failed batch rollback | 按E发现补观察／准确名称；1.9、1.11 | 待实施 |
| E-tests[107] | `tools/change-plan/tests/lifecycle.test.ts`：plan refreshes the baseline without inspecting the old distance | 按E发现补观察／准确名称；1.9、1.11 | 待实施 |
| E-tests[132] | `tools/lightweight-judgment/tests/adapter-images.test.ts`：image permissions scan every scope and malformed inline nodes refuse before credentials storage assets or HTTP | 按E发现补观察／准确名称；1.9、1.11 | 待实施 |

### F 切面

| 来源行 | 最小入口（文件／名称） | 计划处置／任务 | 实施结果／证据 |
| --- | --- | --- | --- |
| F-tests[16] | `tools/index-runtime/tests/protocol-query.test.ts`：extracts closed query sources and rejects invalid source values | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[17] | `tools/index-runtime/tests/protocol-query.test.ts`：materializes an empty state and source-revision record | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[51] | `tools/index-runtime/tests/prepared.test.ts`：prepared readers consume strict field materialization once without weakening raw boundaries | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[66] | `tools/index-runtime/tests/reader-load.test.ts`：reuses loaded snapshot preparation for repeated reader operations | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[81] | `tools/index-runtime/tests/record-staging.test.ts`：record stage domain reuses immutable deterministic target after two fresh acquisitions | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[93] | `tools/skill-updater/tests/public-contract.test.ts`：updater TypeScript entry exposes the public API and consumer types | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[105] | `tools/skill-updater/tests/source-distribution.test.ts`：updater load failures give explicit recovery and frozen installation restores execution | 保留必要规模／真实边界；0.3、2.1 | 待实施 |
| F-tests[128] | `tools/shared/tests/relation-graph.test.ts`：relation structural validation accepts a deep acyclic chain in the actual Node runtime | 保留必要规模／真实边界；0.3、2.1 | 待实施 |
| F-tests[129] | `tools/shared/tests/relation-graph.test.ts`：relation structural validation reports the exact late cycle after a deep chain | 保留必要规模／真实边界；0.3、2.1 | 待实施 |
| F-tests[144] | `tools/shared/tests/record-text-search.test.ts`：record search preserves required reads resource failures and cancellation after display exhaustion | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[151] | `tools/shared/tests/file-text-search-matching.test.ts`：all and any can match terms on different physical lines, while phrase cannot | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[164] | `tools/shared/tests/version-control-representation.test.ts`：rejects representation-only pending drift against a captured snapshot | 收窄：双向mode与完整保护后继成立才合并，否则保留；1.10 | 待实施 |
| F-tests[172] | `tools/shared/tests/version-control-pathspec-query.test.ts`：Git path-query merging preserves within-batch duplicate records | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[173] | `tools/shared/tests/version-control-pathspec-query.test.ts`：Git path queries reject later batch failure without partial results | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[195] | `tools/shared/tests/version-control-workspace.test.ts`：converts absolute descendants to normalized repository paths | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[203] | `tools/shared/tests/version-control-blob-framing.test.ts`：streamed blob transport retains the default stderr budget even with valid payload framing | 保留必要规模／真实边界；0.3、2.1 | 待实施 |
| F-tests[209] | `tools/shared/tests/version-control-prefix-integrity.test.ts`：revision prefixes preserve binary bytes and completeness while draining all full payloads | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[222] | `tools/shared/tests/version-control-fingerprint-demand.test.ts`：both fingerprint modes account for the entire stdout budget even when all content is discarded | 保留必要规模／真实边界；0.3、2.1 | 待实施 |
| F-tests[225] | `tools/shared/tests/version-control-pending.test.ts`：restores the original range after a pending write failure | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[239] | `tools/shared/tests/version-control-snapshot.test.ts`：pending snapshot locked CAS rejects bytes drift without publication | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
| F-tests[270] | `scripts/validate.test.ts`：repository validation skips skill links while preserving skill structure failures | 按F发现补观察／轻量化／准确名称；1.10、1.12 | 待实施 |
