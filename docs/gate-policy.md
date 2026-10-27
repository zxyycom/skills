# Gate 项目运行与质量政策

本文供核对性能预算、输入证明、调度与原生材料范围时按需读取。先以[项目验证模型](validation-model.md)理解证明责任，再从[权威 Vibe 门禁](gate-execution.md#权威-vibe-门禁)选择执行范围。 门禁先按范围选择执行，再以输入证明决定可复用项；调度资源约束实际运行，原生材料按当前范围和质量规则结算，性能政策补充 CLI 成功条件。运行结果与输入诊断由[运行结果与诊断](gate-runtime.md)承接。

## 性能报告与快速预算

每轮报告总墙钟和本轮实际执行 Check 的耗时统计。quick 必须同时满足 total < 30s、P90 < 10s、mean < 5s；任一达到或超过阈值即失败。changed、full、CI 与 release 只报告，不设硬预算。

总墙钟使用单调时钟，从 `runVibeCheck` 入口、输入采集前开始，覆盖业务收尾（含 changed receipt 发布），在性能报告前采样。quick 初判通过时，在报告后末次采样；若此时达到总墙钟阈值，仅补写一次失败报告，不循环。末次采样后的打印、最终报告落盘和 return，以及函数前模块加载、父 Bun 启动均不计入；这不是强制超时终止承诺。

Check 样本只取原生本轮实际 execution/settlement 时长：null、未执行和 receipt 复用项不补零，实际 0 保留；nearest-rank P90 为升序样本第 `ceil(0.9*n)` 项。无样本或非法测量如实报告，并使 quick 失败。

性能政策补充 CLI 成功条件，不改写原生质量 aggregate。项目附加性能 summary 写入不可用时，quick 失败；其余范围明确 warning，不改变原生质量结论或 changed 的 receipt 成功事务。quick 不调用 receipt publisher，预算失败或报告后超限均不会新增通过证明。


## 项目输入与成功证明

quick 和 changed 可以消费既有 receipt；只有 changed 可以发布，quick 保留已有文件不作写入，full/CI/release 不采集或复用。receipt 只证明某个纳入完整输入契约的 Check 在完整有效输入下曾通过，不按 branch、HEAD 或目录时间推断。项目承担的最小事务是“输入声明 → 内容与环境身份 → 精确 passed 记录 → 最终成功且无漂移发布”：

1. 可复用 Check 必须声明完整实际输入，包括源码、测试、生成物、配置及其传递依赖，并绑定相关工具链与环境；声明与修改方法见 [Check 编写契约](gate-check-authoring.md#项目输入证明)。采集还覆盖实际读取的 ignored 材料及目录身份。
2. 未知路径、未归属领域文件、symlink、不支持的文件类型、读取错误、采集超限或必要工具探测失败使证明不闭合：在当前有效范围保守执行，不发布部分证明；quick 不因此升级为完整 base。采集上限和回退诊断见[运行结果与诊断](gate-runtime.md#输入证明诊断)。领域归属检查不能代替 import 和动态读取的依赖审查。根依赖以受信 `pnpm install --frozen-lockfile` 为前提；包管理器外改写依赖后先修复安装。
3. 只有完整 Check 指纹及订阅能力指纹精确匹配的 passed 记录可复用。缺失、损坏或变化扩大执行；工具链、环境与契约版本变化也影响身份。敏感环境原值不写入证明。
4. 只有 changed 的最终 Run completed/passed，且本次所有实际执行项（包括共享输入和成功前置带入项）均 passed，才重新采集同一输入域；workspace 与工具链指纹无漂移后，原子发布本次通过和精确复用的证明。失败、取消、输出错误、输入未闭合、漂移、采集或写入失败均不发布；起止漂移只阻止发布，不额外改变本次 Gate 结算。cache 不可用只扩大执行，不改变质量结论。

性能 history 只影响调度偏好，原生计算缓存仍按当前材料与规则结算；二者均不是成功 receipt。执行与证明取舍见[原生执行与项目输入证明决策](decisions/separate-quick-gate-from-complete-validation.md)。


## 调度与命令执行

Gate 最多并行 4 项，外部进程容量为 3、仓库扫描容量为 2；release CPU 容量为 4，版本管理测试独占全部 CPU 容量。资源从准入持有到结算，性能 history 不能越过硬约束。history 缺失或不可用不改变质量结论，无依赖 Check 即使已有其他失败仍独立结算；隔离的理由与复核条件见[独立资源边界决策](decisions/retain-release-version-control-isolation.md)。

每个命令 Check 从项目根以独立 argv 和继承环境运行，保留完整 transcript；环境命令超时 30s、stdout/stderr 各限 1 MiB，其余命令超时 120s、各限 16 MiB。非零退出失败，无法启动、超时、取消或捕获不完整按 unavailable 结算。失败提示给出重跑命令和 transcript 路径；原始输出不嵌入 machine data。


## 原生材料范围与质量政策

八项原生 Check 的项目配置由 `checks/native.ts` 维护，使用完整 patterns 和原生默认排除。代码类检查读取磁盘中 `scripts/`、`tools/` 的 JavaScript/TypeScript；`docs/investigations/_resources/**` 作为非当前维护材料排除。JSON 与 Markdown 链接显式选择 JSON/Markdown 扩展名，并同时排除调查 `_candidate.*` 作者工作台；格式判断由对应原生 Check 完成。

| 检查 | 当前范围与结算 |
| --- | --- |
| 重复检测 | 维护代码；不少于 150 tokens 的重复片段形成 blocking finding。原生 fragments cache 位于 `.log/vibe-check/cache/duplicate-fragments/`，本次仍按当前配置结算。 |
| 密钥检测 | 维护文本型扩展名、Git 属性/忽略文件与 hooks；5,120 文件、单文件 1 MiB、64 MiB 总量上限，高置信 PEM private-key finding、coverage gap 或 unavailable 阻断。 |
| JSON / Schema | JSON 检查维护材料；Schema 显式选择 Task Graph/Test Evidence 的两项 schema 和两项 binding，以配置为 schema 身份，使用 offline registry/catalog。 |
| Markdown 链接 | 当前维护材料的直接 target、anchor、目录和 symlink 由本次验证承担；root-external 使用 report 边界。有限预算覆盖完整维护范围：单文件 1 MiB、10,000 个语义 occurrence、4,096 次直接端点逻辑校验（含 memo 命中，不是唯一 target 数）。parse-facts cache 位于 `.log/vibe-check/cache/markdown-parse-facts/`，命中仍重新验证目标并结算。 |
| Markdown 内容 | `**/*.[mM][dD]` 与 `**/*.[mM][aA][rR][kK][dD][oO][wW][nN]`，另排除调查资源、调查 `_candidate.*`、`skills/**/references/upstream/**` 和 `skills/**/reference-original.md`。blocking 六规则：`no-reversed-links`、`no-missing-space-atx`、`no-empty-links`、`no-alt-text`、`reference-links-images`、`table-column-count`；完整输入精确命中成功 receipt 时可省略；执行时可复用 `.log/vibe-check/cache/markdown-lint-facts/` 的逐文件计算事实，仍按完整当前范围和规则结算。链接/锚点由独立 Check 每轮验证。 |
| 文件/函数指标 | 全部使用 blocking policy。文件指标使用 PATH SCC 4.0.0，函数指标使用随包 TypeScript analyzer；finding 进入本次 `machine/records.ndjson`。 |

函数普通上限依次为 NLOC、CCN、nesting depth、参数数：产品源码 `45/10/5/5`，自动化脚本 `80/16/8/7`，测试 `100/20/10/8`。低复杂度 NLOC allowance 分别为 CCN 严格低于 `5/7/8` 时允许到 `120/220/250`。每条阻断信号都须验收前处置，仍按[编码规范](coding-style.md#6-保持局部可推理并按责任组织代码)复核真实责任，不以放宽阈值或批量 waiver 替代整改。finding 数量与耗时是测量，不是固定 catalog 边界。
