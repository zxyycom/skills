# Vibe Check 升级依据

本文件先列完成态结果与验证边界，再保存来源、方案依据和历史测量。方案由 [design.md](design.md)承接，任务状态由 [tasks.md](tasks.md)承接。

## 当前验收结论

0.0.4 Gate 接入、两领域逐项测试分层、Case 交接和独立审查均已完成；最终 base、本地 CI 与冷 release 全部通过。
原测试义务有明确覆盖后继，必要真实 Git/Node 边界保持；同机完整 CLI 成本已实测，**没有稳定提速证据**。
本轮单 owner 17.629s、共享 owner 35.307s，均不能称达成历史 ≤15s 目标。
当前验收依据逐项正确性、合适层级与必要边界，不以统一耗时目标驱动生产 CLI 改造。

结果入口：[测试分层结果](#测试分层结果)、[最终完整验证](#最终完整验证)、[任务](tasks.md)。
全部 28 项任务已有完成证据，完成态提交与实际 finalize 由主代理接续执行；本文不声明已提交或已结项删除。
下方历史通过结果仅证明各自当时输入，原始数值和当时目标保持不变。

## 测试分层结果

以 `.log/vibe-check/test-layer-audit/before.json` 的 1306 个项目实体为审计前快照，
两领域全部 612 个原最小原生节点已逐项对账。精确身份、覆盖后继和理由见
[调查报告审计](test-layer-audit/investigation-report.json)与[决策记录审计](test-layer-audit/decision-records.json)。

| 对象 | 原节点 → 最终节点 | 整节点下沉 | 真实 Git 节点 | 真实 Node 节点 |
| --- | --- | --- | --- | --- |
| 调查报告 | 310 → 309 | 45 | 110 | 4 |
| 决策记录 | 302 → 302 | 39 | 50 | 4 |
| 合计 | 612 → 611 | 84 | 160 | 8 |

调查报告另精简 3 处辅助路径/fixture，删除 1 个弱重复节点，由现有更强测试承接；
3 个真实入口节点补强断言。辅助精简不计入 84 个整节点下沉。
决策记录另保留 1 个 Git 不可用集成节点和 1 个分发 SDK 编译节点，分别证明对应外部边界。

独立规则直接验证真实领域函数，参数、输出和错误映射由同进程 CLI 承接；涉及文件获取的领域测试仍标明实际 I/O。
同进程 CLI 与真实 Node 分开计数。真实 Git 测试继续覆盖索引隔离、事务原子性、回滚和路径漂移等义务，
真实 Node 节点保留分发启动、argv、模块装载、stdout/stderr 与退出边界。节点数量是审计统计，不替代具体断言。

内部规则提取涉及调查报告 4 个、决策记录 2 个源码模块，提取函数均由生产路径调用；公开 barrel 与业务契约保持。
对应 skill 已提升为调查报告 69、决策记录 79，完成 sync、只读生成检查及 validate；
本 Change 既有 Task Graph 27、Test Evidence Review 39 的版本事实保留。
长期 Tests/Contract/Proves 已由 Case/index owner 同步；本目录审计 JSON 随 Change finalize 删除，由 Git 恢复。

### 已取得的验证与审查

| 证据 | 实际结果与边界 |
| --- | --- |
| 领域聚合 | 调查报告 309 pass、决策记录 302 pass，均 0 fail；为后续审查补强前的完整聚合结果。 |
| 静态验证 | 两领域定向 lint、scoped typecheck、format 通过。 |
| 最低 Node 环境 | PATH 指定 Node 24.18.0、Bun 1.4.2，决策记录 public-distribution wrapper 46 pass，调查报告 cli-contract wrapper 57 pass，均 0 fail。103 是入口测试数，不是 Node 子进程启动数。 |
| 调查报告审查跟进 | 补足空 `replacements` 输入失败观察，受影响 relation-review 文件 5/5 通过，最终完整 Gate 亦通过。 |
| 决策记录审查跟进 | 既有同进程 CLI 节点以 4 条记录区分标签 A、B、A+B 与对齐状态；真实重复 `--tag` AND、`--alignment unaligned`、`--full-time` 断言唯一 ID、完整 timestamp、total 1 及 index 字节不变。定向 1/1、聚合 302/302 和 lint/types/format 通过；独立审查最终复核已闭合。 |
| 代码优化 | 优化代理复核本轮 38 个已跟踪文件及 4 个 helper 的 diff，无必须修改；独立正确性审查另行完成，无未闭合发现。 |

最低 Node 环境日志位于 `.log/vibe-check/test-layer-audit/final-node24-{decision,investigation}.log`。
两个领域的独立正确性审查已闭合；两处 Case 过宽措辞收窄后再次同步并检查通过。
最终 1152 个 Case 覆盖 1305 个项目原生实体。对账确认两领域全部 612 个原节点与 611 个最终节点的实际 locator 均有明确去向，
项目快照仅删除授权的 1 个弱重复节点，没有新增、移动或改名；对账摘要为 `.log/vibe-check/test-layer-audit/reconciliation.json`。

## 最终完整验证

### final4 完整 CLI 与同机成本

在已知工作线程停写、同机 4 CPU quota/6GiB 条件下运行公开完整 CLI，保持 root 4、external-process 3、repository-scan 2。
原生 learned history 全程保留、未重置；envelope/model 均为 v1，545 个 series，观察序列从 150876 增至 151183。
wall 包含初始化和结尾，Run 列为原生报告；CPU 为 RUSAGE_CHILDREN 的 user+system。
10ms `/proc` 采样的进程数是观察下界，RSS 为采样进程合计峰值而非精确 cgroup 峰值；单次改动样本及共享主机方差不支持稳定性能归因。

| 场景 | CLI wall / Run（秒） | 项目执行 / 复用 | CPU 秒 | 进程下界 / 峰值并发 | 峰值合计 RSS（KiB） |
| --- | --- | --- | --- | --- | --- |
| 建立当前证明 | 73.655 / 69.9 | 52 / 0 | 247.200 | 3151 / 24 | 2199568 |
| 无变化 1 | 8.512 / 5.9 | 0 / 52 | 14.032 | 59 / 21 | 648832 |
| 无变化 2 | 8.512 / 6.1 | 0 / 52 | 14.203 | 56 / 22 | 689148 |
| 无变化 3 | 8.038 / 5.8 | 0 / 52 | 13.426 | 56 / 23 | 636460 |
| MCPShell 单 owner | 17.629 / 15.1 | 10 / 42 | 43.109 | 447 / 19 | 1076992 |
| 单 owner 精确恢复后 | 15.698 / 13.1 | 10 / 42 | 37.971 | 379 / 23 | 1073196 |
| 共享 owner | 35.307 / 32.8 | 19 / 33 | 105.337 | 1310 / 18 | 1193368 |
| 共享 owner 精确恢复后 | 36.155 / 33.5 | 19 / 33 | 109.145 | 1357 / 18 | 1358796 |
| 本地 CI=1 | 90.397 / 89.8 | 全执行 / 不复用 | 313.058 | 3678 / 24 | 1412016 |
| 冷 release | 94.382 / 93.8 | 全执行 / 不复用 | 307.026 | 4524 / 26 | 1447568 |

全部调用 exit 0。建立证明为 61 passed、3 release 不适用；无变化三轮均为环境/原生材料 9 passed、55 inactive。
单 owner 及恢复轮均为 19 passed、45 inactive，共享及恢复轮均为 28 passed、36 inactive。
普通模式每轮都发布完整 52 项 receipt；无变化三轮均 <10s。
本地 `CI=1` 为 61 passed、3 release 不适用，冷 release 为 64/64 passed；两者不采集、读取或发布 receipt。
CI 的 incremental summary 中 execute=64 是禁用复用时的计划投影，不代表三项 release 已实际执行；实际结果以原生 snapshot 为准。

单 owner 改动为 MCPShell 真实源码及生成副本，sync 准备 0.209s；共享改动为同一个 `record-search-output.ts` 源码及调查报告、决策记录两个生成副本，准备 3.910s。
准备成本单列，不混入 Gate wall。所有临时源码、生成物字节与 mode 均精确恢复，各测量窗口 index 不变。

共享样本对照 final3：wall 32.599→35.307s，CPU 104.853→105.337s；MCPShell 对照 final2：13.116→17.629s。
84 个整节点下沉取得的是覆盖与层级合理性，**不能据这些样本声称完整 Gate 稳定提速或达到 ≤15s**。
完整逐项事实、恢复 hash、history 前后状态与采样摘要保存在本地可丢弃的 `.log/vibe-check/performance-004-final/final4-samples-summary.json`，
本文保存可由 Git 恢复的关键验收数值与边界。

### 冷 release 制品与最终交接

冷 release 的 prepare、version authorization、pack 均 passed，version issues 为 0。
授权基线为 `26b9cd210baf97eb1b59699dd56ef028cb584d34`，244 条任务相关路径的 pending tree 为
`b6088ecc61a000c18ca2c27e5c7924a191368b6a`；私有交接消费同一快照的接线已独立审查。
`dist/skill-release-manifest.json` 实际包含 24 个 skill，其中调查报告 69、决策记录 79、Task Graph 27、Test Evidence Review 39。
该树记录冷 release 的实际授权输入；随后补齐的完成态证据文字和任务勾选与制品输入分别核对。

三条本 Change 的继任决策已通过公开 `mark-aligned` 对齐；strict check 通过：387 records、148 active（145 aligned、3 unaligned）、239 archive。
其余三条 unaligned 保持原状。Case/index、全部原节点对账、生成与版本检查、两领域独立审查均完成，最终代码优化没有必须修改项。
测量后已由主代理暂存全部可归因任务文件，最终证据文档更新仍由主代理纳入完成态提交；当前尚未提交或执行 finalize。

最低 Node 24.18 的两个公开 wrapper 46+57 pass 仍是有效边界证据，后续未改变源码或公开 SDK。
远端 CI、真实 Windows 与远端发布未验证；本地完整验证、制品形成和外部发布是不同事实。

## 来源与身份

Readiness 审计日期为 2026-10-20，项目源码基线为 `7bd8a96754ef9226ee369a6a1d9dd364183d3370`。
基线根依赖声明 `^0.0.2`，安装与 lock 为 0.0.2；升级发布物固定为
[vibe-check-0.0.4.tgz](https://registry.npmjs.org/@zxyycom/vibe-check/-/vibe-check-0.0.4.tgz)，1500651 bytes。
下载内容与 registry integrity 的 SHA-512 一致：

```text
sha512-jwEIc4GX/8YMX6cJoluTj9FzbM7K3e6GMUoqL+tqByAVmhd2OhqlqkzHLwa3rSUvKqZKT0uuG6CSNT8Q51+Scw==
```

精确 API 依据来自该发布包内的文件：

| 核对对象 | 包内入口 |
| --- | --- |
| Gate、回调、依赖和命令 | `README.md`、`docs/api-mechanics.md`、`docs/guides/{building-project-gate,callbacks,check-dependencies,command-check}.md` |
| 输入、缓存、调度和结果 | `docs/guides/{collecting-project-files,cache-results,scheduling,learned-scheduling,run-outputs}.md` |
| 原生 Checks 与 breaking contracts | `docs/checks/*.md`、`docs/changelog.md`、`types/**/*.d.ts` |

复核时取得同一发布物、校验摘要后按表阅读；这些契约与下方摘要共同支持实施，无需本机调查目录。
Readiness 的隔离安装使用 pnpm 12.4.2，当时未改动根安装。
项目测量环境为 Linux、Node 26.8.2、Bun 1.4.2、pnpm 11.7.0、SCC 4.0.0，
6 个可见 CPU、4 CPU quota、6GiB 内存上限。

## 项目成本基线

以下为 Readiness 期间的既有观测，CLI 墙钟包含初始化与结尾成本，Run 内耗时仅覆盖 Vibe Run。

| 项目工作负载 | 结果 | 耗时 |
| --- | --- | --- |
| 0.0.2 全量 base，bun run check --diagnostic-log | exit 0；65 passed，3 release 未激活 | Run 内 73.6s；CLI 82.884s |
| 同输入连续三次 base | 均 exit 0；64 项成功复用，环境实际执行 | CLI 2.190 / 1.918 / 1.961s |
| 一次 Change 材料变动后的 base | exit 0；9 passed，59 未激活 | Run 内 17.1s；CLI 27.357s |
| 0.0.4 实际项目材料配置，加 Markdown lint，两轮 | 7 passed；function-metrics 因五条 finding failed | 6.675 / 5.629s |

材料工作负载使用 root 4、external-process 3、repository-scan 2。
采样时原生 selection 覆盖 956 个代码文件；Git 可见 3918 项、原生磁盘 selections 并集 3861 个普通文件，
当时 disk-only 为 0。文件选择仍按新版磁盘契约处理，而非把当时零差集当作 Git 清单充分的证明。
这些观测说明项目成本与指标差异，完整新 Gate 由 Verification 验收。

## 特殊结构的必要性结论

### 项目成功 receipt：保留最小领域责任

随包 Gate 指南的 compareWith 表达相对 Git revision 的变化；cacheJsonByKey 由调用方提供完整计算 key。
两者均不拥有项目最近成功输入、环境身份或最终成功发布事务。
项目需要在首次、clean、提交后、dirty 及环境变化时判断能否安全省略昂贵命令。

Readiness 的 31 项项目命令独立执行中位约 35s，当时成功复用的无变化 CLI 中位约 1.96s。
因此保留的责任是：**真实输入声明 → 完整身份 → 精确通过记录 → 最终成功且无漂移才发布**。
范围限于可省略的项目 Check；具体实现按该责任收敛。原生材料每次实际结算，计算事实按原生能力复用。

### 批次/JUnit：由独立命令替代

基线批次有 31 个 Check、33 次文件引用、33 个唯一文件，重叠为 0；文件去重已无实际收益。
对同一批项目命令，旧批次四 worker 与原生独立命令均真实执行、继承环境并保留 transcript：

| 方式 | 轮次 | Run 内范围 | 中位 |
| --- | --- | --- | --- |
| 原生独立命令 + static | 3 | 27.601–50.285s | 35.018s |
| 旧四 worker + JUnit | 3 | 33.905–37.114s | 34.105s |
| 原生独立命令 + 已学习策略 | 2 | 31.704–39.362s | 35.533s |

每轮均形成 31 项 passed。对照使用四路命令容量，不等于最终三进程预算下的完整 DAG。
批次由 31 次进程启动减为 4 个 worker，但中位差约 0.91s，且共享主机波动明显。
基线五个批次模块约 742 行，另有 leader 接线；当前证据不足以支持这组额外维护面。
独立 commandCheck 提供原生 outcome 和 transcript，保留产品检查义务并替代结果投影及批次成功证明。

### learned：采用原生智能调度

基线已使用 Vibe 的 createLearnedCriticalPathStrategy。随包指南支持按本地时长历史选择 ready Check，
并要求调用方提供 history 目录和时长可比 identity；Scheduler 始终掌握依赖、mutex 和资源硬约束。

上述两轮 learned 测量在一次冷训练后使用历史，未显示稳定短期增益；样本不足以推断未来自适应价值。
选用目标是持续适应 Check、依赖与耗时变化，方案保留原生 helper 及其最小接线。
任务结构和命令方式变化时更新身份，性能历史按原生退化契约处理，与质量成功证明分离。

### 命令限额依据

独立项目命令实测最长约 31.75s，最大 stdout 145 bytes、stderr 10469 bytes；环境命令约 1s。
design 的初始限额为实际负载保留余量，跨平台成本由项目验收确认。

## 生成与外围入口

[syncAllSkillRuntimes](../../scripts/lib/skill-runtime.ts)遍历全部 skill，按 domainAdapters 逐项调用
相同领域的 syncRuntime(check)。统一 `check:skill-updaters` 已执行八个独立生成命令的同一函数、
同一 mode 和同一输入，覆盖入口、源码树、manifest、lock、retired paths 及附属物。
既有全仓 Gate 中两组入口均通过，因此归并后仍保留领域手动入口和产品回归。

| 入口 | 依据与处置 |
| --- | --- |
| check:mcpshell-workspace-bridge | 同一注册表已覆盖，使用统一生成前置。 |
| MCPShell initializer/runtime/generated | 三个现有离线测试文件合计 34 pass、0 fail、2.796s；接入三个独立结果，generated 依赖统一前置。 |
| MCPShell/localhost-SSH 集成 | 需要专用环境，保持显式聚合入口；本次依据为离线结果。 |
| test:index-runtime-performance | 既有专项 1 pass、0 fail、0.824s；[owner](../../tools/index-runtime/README.md)将规模测量定位为按需回归，未定义持续 SLO。 |

身份及依赖的精确映射由[清单](gate-inventory.md#目标身份映射)承接。

## 输入边界

| 对象 | 已确认责任 |
| --- | --- |
| 项目命令 | 源码、test/fixtures、runtime、manifest/lock、配置、环境与工具链；tsconfig 同时包含 `tools/**/*.mts`。 |
| 统一生成 | 全部 skill、domainAdapters、source-runtime/updater、源码闭包及各自附属物。 |
| 原生材料 | 完整 patterns 的磁盘选择与实际读取由本次 Check 处理。 |
| Markdown 链接 | 本次验证承担 source 以外的直接 target、anchor、目录和 symlink；root-external=report，授权读取边界保持。 |
| Schema | 当前两项 schemas、两项 bindings 显式入选，offline 使用声明 registry 与固定 catalog，HTTPS sources 保持关闭。 |
| 项目成功证明 | 起止取得同一输入域，覆盖 missing/symlink 与声明的磁盘输入；未知额外来源、错误及漂移时保守执行。 |
| 依赖与工具链 | 依赖字节沿用受信 frozen-lock 安装前提，工具链探测失败扩大执行。 |

## 指标差异

同一冻结输入的 951 个源码文件、现行三区域阈值和 blocking policy 下，两版 selection 相同。
冻结源 SHA-256 为 `3cd51011d9985c6e3ecae2ed8f4da2ef13592be0bc417517023f878f52b62d1b`。
整改前的 0.0.2 为 0 blocking，0.0.4 为以下 5 blocking；当时 956 文件的项目扫描同样得到五条阻断。

| 路径 | 函数 | 指标 | 新值 / 上限 |
| --- | --- | --- | --- |
| `scripts/test-evidence/snapshot-ast-scan.ts` | anonymous | CCN | 21 / 16 |
| `scripts/test-evidence/legacy.ts` | `parseLegacyCase` | CCN | 21 / 16 |
| `tools/task-graph/src/runtime.ts` | `isSupportedNodeVersion` | nesting depth | 8 / 5 |
| `tools/test-evidence/src/case-source-parser.ts` | `parseSectionItem` | nesting depth | 6 / 5 |
| `tools/test-evidence/src/case-source-parser.ts` | `validateOrderedUnique` | code density | 48 / 45 |

两版差异来自同源测量；1.7 的源码归因和处置见下方“指标与分发”。

## 实施就绪审计

审计门禁由 tasks 的 0.8 记录；只有以下条件均满足才勾选：

| 维度 | 通过条件与读取位置 |
| --- | --- |
| 目标与范围 | proposal 明确结果、质量标准及受影响 owner。 |
| 结构选择 | design 明确 receipt、独立命令、原生智能调度及发布交接，额外结构有必要性依据。 |
| 身份与输入 | 清单覆盖全部 68 个旧身份、归并及新增结果、重跑入口与前置；design 明确输入和保守边界。 |
| API 与版本 | 固定发布物可校验，API 清单覆盖真实 consumer 和包内文档路径。 |
| 任务闭合 | 成功标准 1/2 对应 1.1/1.6、2.1/2.6；3/4 对应 1.4/1.5、2.3/2.4；5 对应 1.3、2.1/2.7；6 对应 1.7、2.5；7/8 对应 1.8、2.7/2.8。 |
| 文档可用性 | 主文档呈现目标方案，证据独立于本机工作台；结构、链接与格式通过项目检查，可从 1.1 推进。 |

2026-10-20 审计通过：68 个基线身份齐全，八项归并加四项新增形成 64 个目标身份；
Change 结构检查有效，六份 Markdown 的链接与 lint 均无 finding，
现有 `bun run check` 为 8 passed、60 未激活、0 failed/unavailable。方案具备从 1.1 开始实施的必要信息。

指标整改、完整新 DAG、frozen-lock 和冷 release 由 tasks 的实施与验证项承接。
最低 Node、Windows 及远端 CI 的实际证据按 2.8 报告，未覆盖的平台明确验证边界。
验证限定项目接入和领域结果，原生通用正确性按精确发布契约使用。

## 实施验证记录

下文保存测试分层前的验证过程；完成态结果以文首为准。

### 指标与分发

五条信号均符合 0.0.4 随包计量契约；按输入解码、section 状态、版本区间和唯一性诊断的真实责任整改，
未调整阈值或增加 waiver。实际项目 956 文件、随后移除批次代码后的 950 文件扫描均为 passed、0 finding。

| 位置 | 整改后值 |
| --- | --- |
| AST callback / metavariable helper | CCN 8 / 14 |
| legacy parser / sections | CCN 9 / 13 |
| Node range | nesting depth 5 |
| section item | nesting depth 5 |
| orderedUnique / uniqueTests | NLOC 33 / 22 |

`bun run test:test-evidence-project` 为 25 pass，`bun run test:test-evidence-cli` 为 36 pass，
`bun run test:task-graph-cli` 为 89 pass 加 native 4 pass；新增九项项目边界回归。
八个相关源码/测试文件定向 Oxlint、Oxfmt 与 diff 检查通过。
Node 24.18 的两个源码测试文件为 17 pass，两个分发测试文件为 10 pass。

已通过 `sync:task-graph-cli`、`sync:test-evidence-cli` 同步生成物，两个对应 `check:*` 均通过；
Task Graph 版本为 27，Test Evidence Review 为 39。生成变化只涉及对应 runtime 源码，无声明或 Schema 漂移。

### Gate 接入与输入证明

固定 pnpm 的 frozen-lock 安装、`bun run typecheck`、`bun run lint` 均通过。
`bun run test:check` 在 Node 26.8.2 为 52/52（7.43s），最低 Node 24.18.0 为 52/52（10.06s）。
项目测试覆盖原生命令参数/环境/transcript/重跑诊断、CLI 终态、同引用私有发布交接及跨 Run 隔离。
实际 catalog 为 64 项，base 范围 61 项；八项领域生成归并及新增四项结果已接入。

18 项项目输入证明测试通过，整仓类型检查和切面 lint 均通过。证明收窄为 52 项项目 Check，
八项原生材料、环境和 release 保持真实执行。采集覆盖 Git 与声明的磁盘域，保留内部 fixtures 的
node_modules/.git 输入；根安装依赖按受信 frozen-lock 前提处理。MCPShell 离线初始化测试的 Python/tomllib
纳入必要工具链探测；探测失败保守执行。单次完整输入采集约 0.83–0.96s，不代表端到端 Gate 耗时。

### 测试分层前的账本

按实际保留入口维护 Case，连续意图沿用身份；新增输入与单次事实复用回归后，
当时为 1153 个 Case 覆盖 1306 个唯一原生测试实体，无失效引用；本轮分层后的最终账本结果见文首。
`bun run sync:test-evidence-catalog`、`bun run test-evidence -- check --root .` 与
`bun run check:test-evidence-catalog` 均通过。

### 测试分层前的优化与正确性复核

独立正确性审查未发现实质阻断，最小项目边界回归为 10/10。
代码优化收敛同构输入声明、去除纯包装与不可达分支、在解码边界使用局部收窄；
四项 grammar 回归按解析 owner 归位，Case 保留意图并更新真实实体定位。
新增回归带来的文件 NLOC 与输入路由 nesting 信号已按责任处理，真实全仓源码的 file/function metrics
均为 0 finding、0 blocking。优化后的 typecheck、lint、52 项 Gate 测试、25 项项目测试和 36 项领域 CLI 测试通过。
末端定向正确性复核确认输入 patterns/顺序、保守边界、失败语义和聚合链保持，无实质阻断。

文档已按 ai-ready-docs 同步当前维护 owner，九份相关 Markdown 的 lint/links 为 0 finding。
该阶段的三条决策继任记录承接执行与成功证明、统一生成前置和版本管理隔离；完成态对齐结果见文首。

### 完整 Gate 与性能整改基线

#### 整改前完整 CLI 样本

新 base Gate 首轮为 61 passed、3 release 未激活、0 failed/unavailable，Run 139.5s；
52 项项目命令全部真实执行并发布成功证明。随后仅收窄 JSON 与 Markdown 链接的文件扩展名 patterns，
实际支持输入集合保持一致，消除分别 3809、2122 条无关格式拒绝记录；两项真实 Check 通过。

以下为同机、无并发验证、完整 CLI 的原始样本，不以局部函数耗时代替反馈时间。
保持 root 4、外部进程 3、repository-scan 2 的预算，使用原生智能调度及既有本地历史。
进程数为 Linux `/proc` 10ms 采样的后代进程下界，CPU 为子进程 user+system，包含命令自身派生工作。

| 场景 | CLI wall / Run | 项目执行 / 复用 | 观测进程 / 峰值并发 | CPU 秒 | 结论 |
| --- | --- | --- | --- | --- | --- |
| patterns 调整后重建证明 | 94.83 / 92.5s | 52 / 0 | 3886 / 27 | 335.92 | 全部通过，非日常反馈 |
| 无输入变化，三轮 | 7.96、9.33、8.09 / 5.8、6.9、5.8s | 0 / 52 | 52–56 / 18–21 | 13.78–16.17 | 均 <10s |
| MCPShell 真实源码及生成物 | 24.58 / 22.3s | 10 / 42 | 496 / 22 | 76.96 | 未达 ≤15s |
| file-text-search 真实共享源码及两个生成消费者 | 70.70 / 68.4s | 52 / 0 | 3201 / 22 | 243.90 | 未达 ≤15s |

两个改动样本均先通过现有同步入口保持生成一致，再测 Gate；准备分别耗时 0.204s、6.88s，
不混入 Gate wall。测后按原字节及 hash 恢复全部源码/生成物，index 保持未变。
这些原始样本保持为整改与复测的比较基线；当时使用的反馈目标不回写，当前验收见文首，资源预算保持。

#### 已完成的关键路径整改

原始样本定位到三类重复成本：统一生成重复扫描全工具 imports、测试快照重复读取共享模块、
项目输入声明覆盖了不被当前 Check 消费的材料。整改保持输入集合与质量政策，只在同次调用内复用事实，
并按实际消费者维护成功证明：

| Owner | 实现与直接证据 |
| --- | --- |
| 统一生成 | `source-runtime` 一次采集源码引用与根 manifest，以只读 facts 参数传给九个 build adapters 和 updater 生成；各 skill 独立构建可达模块，无跨调用 cache。真实全同步为一次 AST scan、24 个 skill、2.72s；7 项 generated-file 测试通过。 |
| 测试快照 | 单次会话缓存模块源码、imports 与存在性，各 command 闭包和注册集合独立，起止 sourceFingerprint 独立读取。读取复用阶段的 14 项 snapshot 测试通过；当时真实 22 commands、1004 个唯一模块的窄幅计数为 readFile 3158→1004、lstat 9796→1025，新旧联合及逐命令闭包相同。 |
| 项目输入声明 | file-text-search 按 Decision Records、Investigation Report、Test Evidence 消费纳入，graph 按前两者纳入；专用测试及全源码消费者保持覆盖，其余 shared 仍为 common。Updater 测试的包输入为实际复制的 ai-ready-docs。20 项输入证明回归、typecheck、切面 lint 通过。 |

跨 owner import 与入口变更联动静态输入声明的维护义务已落入[Check 编写 owner](../../docs/gate-check-authoring.md#项目输入证明)。
单次事实复用的范围、跨调用隔离和独立漂移读取由[工具链](../../docs/tooling.md)承接。

#### 原生编译与合并扫描的局部证据

根 `tsconfig.json` 启用原生 incremental，build info 位于 `.log/vibe-check/cache/typecheck/tsconfig.tsbuildinfo`。
`tsgo --noEmit`、质量选项及 include 保持不变，compiler 每次均结算完整 1858 个文件。
同机六轮直接类型检查如下，单位为秒：

| 调用 | wall | CPU（user + system） |
| --- | --- | --- |
| 原配置基线 | 5.382 | 12.695 |
| 原生 incremental 冷运行 | 5.142 | 11.864 |
| 原生 incremental warm 1 | 0.398 | 1.165 |
| 原生 incremental warm 2 | 0.421 | 1.219 |
| 同一 MCPShell 真实源码 comment 变更 | 0.753 | 1.495 |
| 恢复源码后 | 0.968 | 1.585 |

编译器 cache 可丢弃重建，不是成功 receipt；这些直接调用不证明完整 Gate ≤15s。

快照七项 AST pattern 对普通 `.ts` 且不含 `ast-grep-ignore` 文本的输入使用一次多规则 scan，
其余路径保持 run 兼容查询，无新增持久 cache。真实 AST CPU 从 4.154s 降至 1.255s；
新旧完整 snapshot deepEqual：1306 个实体及其 ID、名称、locator、顺序和 source 均相同。
当前各 command 的注册闭包与起止指纹保持独立。
最新定向验证为输入 20 项、snapshot 16 项、project 29 项、generated-file 7 项，typecheck 与 lint 均通过。

#### 中间轮完整 Gate 与并发写域核对

下表保留最终重测前已经执行的完整 CLI 样本；失败轮不作为成功反馈达标证据。

| 场景 | CLI wall / Run | 结果 |
| --- | --- | --- |
| 重建输入证明 | 84.90 / 81.1s | 全部 61 项 base passed。 |
| 无输入变化，三轮 | 7.63、7.40、7.80s / 未单列 | 均成功。 |
| 单 owner | 25.68 / 21.5s | secret 检查为 source-unavailable，Gate 未通过，receipt 正确未发布。 |
| 共享 owner | 未执行 | 按本轮 fail-stop 边界停止后续测量。 |

随后确认 generated-file 的两个测试会临时写宿主 `tools/` / `skills/`，与材料 scanner 存在并发写读域。
原始失败日志未给出具体 path，因此这项已证实风险不能作为历史 source-unavailable 的唯一根因。
两项测试已改用 `os.tmpdir()` 下的隔离 workspace；默认生产 root 保持不变，来源不同的 facts 拒绝消费。
真实 secret Check 与测试并发通过，宿主文件事件为 0，独立正确性复核通过。
这组证据证明隔离修复的边界，不替代最终完整 Gate 复测。

#### final2 完整 CLI 与冷 release

在测试写域隔离后，保持原生 learned 调度、本地 history 与既定资源容量，取得下列完整 CLI 样本。
wall 包含 Gate 初始化和结尾，sync 准备单列，不计入 Gate wall；CPU 为子进程 user+system。

| 场景 | CLI wall / Run（秒） | 项目执行 / 复用 | 实际结果 |
| --- | --- | --- | --- |
| 建立输入证明 | 67.801 / 65.6 | 52 / 0 | base 61 passed。 |
| 无输入变化，三轮 | 7.393、7.355、7.273 / 5.3、5.3、5.2 | 0 / 52 | 每轮 9 passed，均 <10s。 |
| MCPShell 真实源码与同步生成物 | 13.116 / 10.8 | 10 / 42 | 19 passed，CPU 36.946s；sync 准备 0.204s，满足 ≤15s。 |
| MCPShell 恢复后调用 | 10.192 / 8.1 | 未单列 | 全部源码字节与 mode 恢复，index 未变。 |
| 共享 record 输出 helper（三文件） | 33.384 / 31.2 | 25 / 27 | 34 passed、0 failed，CPU 107.147s；sync 准备 3.276s，未满足 ≤15s。 |
| 冷 release | 86.4695 / 85.8 | 全实际执行 | 64/64 passed，不采集、读取或发布 receipt。 |

共享样本最重的三个 Check 为 Investigation Report pending（17.7s）、Decision Records lifecycle（12s）与
pending-stage（6.8s），均真实读取产品 CLI；这是当时执行成本，不预设每个原测试都必须保留该层级。10ms 后代进程采样观察到 1368 项，
其中可识别 Git 773、Bun 160、Node 61；其余短命进程未取得 cmdline，因此总数是观测下界而非精确创建数。

共享样本属于 **25 项项目 Check 执行版**。其中 6 项经消费闭包核对不读取本次具体 helper，
随后按真实闭包细化为 19 项输入声明（Test Evidence 5 项及专用 file-text-search 测试排除此文件）。
该轮 33.384s 为 25 项版历史对照；随后 19 项版见 final3，本轮测试分层后的实际成本见 final4。

冷 release 的 CPU 为 240.505s，观测后代进程 4185、峰值并发 27、峰值内存 1.534GiB。
prepare、authorization 与 pack 消费同一个授权 pending snapshot，打包成功且 index 未变。
形成本次制品时，显式暂存范围只含 Task Graph 27 与 Test Evidence Review 39 的两个 `SKILL.md` 和两个 runtime 文件，
index tree 为 `52dcc14d6174b2865ae48545f6ec1ea0a13b58e7`；普通 Check 的对象仍是当前工作树。
因此这次制品证据覆盖上述两个 skill 的 pending 改动，不代表其余未暂存实现或后续测试分层已进入制品。
没有创建提交或执行外部发布。

#### final3 分层前输入版本与本地 CI

19 项精确消费者版本保持 root 4、external-process 3、repository-scan 2，继续使用原生 learned history，
未手动改写历史。下表为实际 `bun run check`，不是局部脚本或推算结果：

| 场景 | CLI wall / Run（秒） | 项目执行 / 复用 | 结果 |
| --- | --- | --- | --- |
| 当前版本建立证明 | 61.419 / 59.3 | 52 / 0 | 61 passed、3 release 未激活，发布 52 项 receipt。 |
| 真实共享 helper 与两个生成副本 | 32.599 / 30.2 | 19 / 33 | 28 passed、36 未激活，发布 52 项 receipt；sync 准备另计 3.420s，仍未满足 ≤15s。 |
| 精确恢复后的 base | 28.806 / 26.6 | 19 / 33 | 全部成功，为原字节输入发布 52 项 receipt。 |
| 本地 `CI=1` 完整 Gate | 68.232 / 67.6 | 全实际执行 | 61 passed、3 release 未激活，不发布 receipt。 |

该轮共享样本的子进程 CPU 为 104.852905s，同工作量按四核折算下限 26.213s。
最重路径仍为 Investigation Report pending（18.6s）、Decision Records lifecycle（12.4s）、
pending-stage（7.1s），typecheck 为 0.517s。保持这些真实 CLI 工作量时，仅改调度不足以达到 ≤15s。
10ms 采样观察到后代进程 1252 项、峰值并发 22、合计 RSS 峰值 1289600KiB；
进程数是观测下界，RSS 不是精确 cgroup 峰值，汇总 CPU 也不是逐进程归因。
原始摘要位于本地可丢弃的 `.log/vibe-check/performance-004-final/final3-samples-summary.json`，
包含输入 hash、逐项结果和 learned history 的前后状态；本文保存可独立恢复的验收结论。

最初本地 CI 轮仅 `test:check` 中一个增量 fixture 继承 ambient CI 而退出 1。
修复只为该 fixture 显式注入 `continuousIntegration: false`，未改变生产 CI 逻辑或 `process.env`。
CI 与普通模式的 `test:check` 随后各 54/54，通过 typecheck、lint、format，再执行上表完整 CI 成功轮。
测试名称和实体未变；最低 Node 24 另实跑 generated-file 与 snapshot，23/23 通过（2.855s）。
远端 CI 与 Windows 仍未验证。

#### final3 测量恢复与交付边界

共享源码、两个生成副本及其 mode/hash 均已精确还原，辅助 backup 已删除，测量期间 index 保持不变。
上述冷 release 制品继续以形成时保存的 index tree 为依据，不把后来的工作树状态冒充制品输入。
为避免阻塞期间留下可误提交的部分快照，确认该 tree 及仅有四项验收暂存后，已撤回这四项暂存；
撤回前后工作树字节 hash 相同。该轮结束时 index 为空，HEAD 为 `26b9cd21`，没有实现提交、push 或远端发布。
