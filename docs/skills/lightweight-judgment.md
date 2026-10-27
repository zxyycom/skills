# Lightweight Judgment

`lightweight-judgment` 是按需点名使用的能力：用户明确指定该 skill 后，agent 才通过 JEV 或 OpenAI Decisions 完成分类、候选选择、相关性筛选、命题判断和程度评分。适合输出空间明确、需要语义理解、结果可复核或回退的局部任务。

## 使用方式

在任务中点名 `$lightweight-judgment` 即可显式调用。包内 [agents/openai.yaml](../../skills/lightweight-judgment/agents/openai.yaml) 将 Codex 的 `policy.allow_implicit_invocation` 设为 `false`，使安装后的 skill 按此方式启用。

agent 负责选择局部任务、组织输入、复核结果并继续原任务；CLI 负责本地检查、离线预览、单次请求和机械响应校验。统一输入沿用 JEV state/questions；可信配置选择旧 OpenRouter System One、TypeSafe 原生、OpenRouter alpha 或直接 OpenAI Decisions。CLI 自动编译，保留 provider 原答并输出独立 normalized；不能保真的能力组合在发送前拒绝。

图片仅接受显式内联 PNG/JPEG，按通道编译；JEV Box 与长上下文须满足可信配置及模型条件。OAI 只支持共享 state 图片、不支持 Box；不隐式抓外链、读路径或拆题。精确边界见[包内接入合同](../../skills/lightweight-judgment/references/protocol-adapters.md)。

调用日志默认关闭。手动开启后，本地 SQLite 保存调用状态及选定的请求／响应正文，供进程中断后核对。离线 `stats` 汇总已有日志的用量／耗时，支持分层、分桶与批次首条对照；每次推理仍直接调用，不自动重放。

skill 包含行为文档、TS CLI 与模块源码、Codex 调用策略和通用 updater。分发后按[工具运行前置](../../skills/lightweight-judgment/SKILL.md#工具运行前置)复用兼容依赖或显式安装，再使用 Node.js 直接运行；仓库内可从 `bun run lightweight-judgment -- --help` 开始。

## 阅读入口

- [SKILL.md](../../skills/lightweight-judgment/SKILL.md)：agent 执行入口，承接任务选择、请求构造、结果复核与采用。
- [模型对照与选择](../../skills/lightweight-judgment/references/model-comparison.md)：JEV 1.13、1.14 与 Decisions 的基础差别、效果与开销证据，以及按需求选型建议。
- [CLI 操作契约](../../skills/lightweight-judgment/references/cli.md)：运行前置、配置、输入输出、响应校验与技术失败。
- [接入合同与模态](../../skills/lightweight-judgment/references/protocol-adapters.md)：各 adapter、OAI 文本转换、图片作用域、Box、长上下文与统一结果。
- [调用日志](../../skills/lightweight-judgment/references/call-logging.md)：可选 SQLite 留存、调用状态、恢复与当前结构要求。
- [保留数据的版本迁移](../../skills/lightweight-judgment/migrations/README.md)：仅在需要旧历史时读取，按版本说明字段含义与回填依据，可确定的简单转换才附脚本；不保留历史可直接重新建库。
- [离线调用统计](../../skills/lightweight-judgment/references/statistics.md)：`stats` 用法、统计口径、批次对照与只读边界。
- [JEV 使用边界与任务验证](../../skills/lightweight-judgment/references/jev-characteristics.md)：可访问的官方模型说明、输入准备、结果解读与目标任务验证方法。

## 模型与接口调查

以下是仓库内的设计与选型资料，不随 skill 分发。按各报告的取证日期、版本和测量条件解读；当前已实现能力由上方的 `SKILL.md` 与 CLI 操作契约承接。

模型选型的历史证据包括 [Laya](../investigations/laya-decision-model-evidence.md)、[Intern-Decision 与 CLM](../investigations/intern-decision-clm-evidence.md)、[OpenAI Decisions 接口](../investigations/openai-decisions-api-contract.md)、[Decisions 与 Jev 对照](../investigations/openai-decisions-jev-comparison.md) 和 [Jev 1.14](../investigations/jev-1-14-capabilities-and-comparison.md)。各报告分别记录取证日期、测量条件和证据缺口。

2026-10-17 的接入设计依据分别见 [JEV 到 OpenAI Decisions 的映射](../investigations/jev-carrier-openai-decisions-mapping.md)、[图片、Box 与长上下文](../investigations/decision-model-multimodal-long-context-integration.md) 和 [跨协议运行时](../investigations/lightweight-judgment-multi-protocol-runtime-boundaries.md)。[OpenRouter 真协议取证](../investigations/openrouter-decision-live-protocols.md)区分直接 HTTP 与 CLI 的有限样本：它不证明 Box 精度、整体质量或最大容量。原生 TypeSafe／OpenAI 仅有离线／mock 合同验证；OpenRouter 指定 OpenAI 路由返回 403，原因、成功响应与拒答形状未证。

接口兼容与目标任务效果分别验收；维护时按目标版本核对来源、能力限制和未验证项。

## 验证责任

CLI 的本地验证边界见操作契约；模型的输入风险与任务验证方法见对应引用。实际采用时，用目标任务验证分类与精确求值的分流、独立问题与依赖问题的拆分、缺证与技术失败的区分，以及外发和高风险动作的权限边界。
