# Vibe Check 升级依据

本文件保存版本来源、项目观察及方案依据。选择由 [design.md](design.md)承接，进度由 [tasks.md](tasks.md)承接。

## 来源与身份

审计日期为 2026-10-20，项目源码基线为 `7bd8a96754ef9226ee369a6a1d9dd364183d3370`。
根依赖声明 `^0.0.2`，安装与 lock 为 0.0.2；目标固定为
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
隔离安装使用 pnpm 12.4.2，根安装保持不变。
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

31 项真实项目命令的独立执行中位约 35s，现有精确成功复用的无变化 CLI 中位约 1.96s。
因此保留的责任是：**真实输入声明 → 完整身份 → 精确通过记录 → 最终成功且无漂移才发布**。
范围限于可省略的项目 Check；具体实现按该责任收敛。原生材料每次实际结算，计算事实按原生能力复用。

### 批次/JUnit：由独立命令替代

当前批次有 31 个 Check、33 次文件引用、33 个唯一文件，重叠为 0；文件去重已无实际收益。
对同一批项目命令，旧批次四 worker 与原生独立命令均真实执行、继承环境并保留 transcript：

| 方式 | 轮次 | Run 内范围 | 中位 |
| --- | --- | --- | --- |
| 原生独立命令 + static | 3 | 27.601–50.285s | 35.018s |
| 旧四 worker + JUnit | 3 | 33.905–37.114s | 34.105s |
| 原生独立命令 + 已学习策略 | 2 | 31.704–39.362s | 35.533s |

每轮均形成 31 项 passed。对照使用四路命令容量，不等于最终三进程预算下的完整 DAG。
批次由 31 次进程启动减为 4 个 worker，但中位差约 0.91s，且共享主机波动明显。
现有五个批次模块约 742 行，另有 leader 接线；当前证据不足以支持这组额外维护面。
独立 commandCheck 提供原生 outcome 和 transcript，保留产品检查义务并替代结果投影及批次成功证明。

### learned：采用原生智能调度

项目已使用 Vibe 的 createLearnedCriticalPathStrategy。随包指南支持按本地时长历史选择 ready Check，
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
0.0.2 为 0 blocking，0.0.4 为以下 5 blocking；当前 956 文件的项目扫描仍得到五条阻断。

| 路径 | 函数 | 指标 | 新值 / 上限 |
| --- | --- | --- | --- |
| `scripts/test-evidence/snapshot-ast-scan.ts` | anonymous | CCN | 21 / 16 |
| `scripts/test-evidence/legacy.ts` | `parseLegacyCase` | CCN | 21 / 16 |
| `tools/task-graph/src/runtime.ts` | `isSupportedNodeVersion` | nesting depth | 8 / 5 |
| `tools/test-evidence/src/case-source-parser.ts` | `parseSectionItem` | nesting depth | 6 / 5 |
| `tools/test-evidence/src/case-source-parser.ts` | `validateOrderedUnique` | code density | 48 / 45 |

两版差异来自同源测量，具体源码责任或分析器原因由 1.7 逐条归因，按现行政策处置。

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
