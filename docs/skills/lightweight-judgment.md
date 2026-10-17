# Lightweight Judgment

`lightweight-judgment` 是按需点名使用的能力：用户明确指定该 skill 后，agent 才通过 JEV 或 OpenAI Decisions 完成分类、候选选择、相关性筛选、命题判断和程度评分。适合输出空间明确、需要语义理解、结果可复核或回退的局部任务。

## 使用方式

在任务中点名 `$lightweight-judgment` 即可显式调用。包内 [agents/openai.yaml](../../skills/lightweight-judgment/agents/openai.yaml) 将 Codex 的 `policy.allow_implicit_invocation` 设为 `false`，使安装后的 skill 按此方式启用。

agent 负责选择局部任务、组织输入、复核结果并继续原任务；CLI 负责本地检查、离线预览、单次请求和机械响应校验。统一输入沿用 JEV state/questions；可信配置选择旧 OpenRouter System One、TypeSafe 原生、OpenRouter alpha 或直接 OpenAI Decisions。CLI 自动编译，保留 provider 原答并输出独立 normalized；不能保真的能力组合在发送前拒绝。

图片仅接受显式内联 PNG/JPEG，按通道编译；JEV Box 与长上下文须满足可信配置及模型条件。OAI 只支持共享 state 图片、不支持 Box；不隐式抓外链、读路径或拆题。精确边界见[包内接入合同](../../skills/lightweight-judgment/references/protocol-adapters.md)。

调用日志默认关闭。手动开启后，本地 SQLite 保存调用状态及选定的请求／响应正文，供进程中断后核对。离线 `stats` 汇总已有日志的用量／耗时，支持分层、分桶与批次首条对照；每次推理仍直接调用，不自动重放。

skill 包含行为文档、自包含 CLI／source map、Codex 调用策略与通用 updater。分发后使用 Node.js 直接运行；仓库内可从 `bun run lightweight-judgment -- --help` 开始。

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

### 模型与效果证据

| 取证日期 | 调查 | 主要内容 |
| --- | --- | --- |
| 2026-09-20 | [Laya](../investigations/laya-decision-model-evidence.md) | 本地实现、上下文与候选限制、领域微调及性能证据 |
| 2026-09-26 | [Intern-Decision 与 CLM](../investigations/intern-decision-clm-evidence.md) | 类型语义、校准入口、缓存、部署及官方／第三方测量 |
| 2026-10-09 | [OpenAI Decisions 接口](../investigations/openai-decisions-api-contract.md) | 请求与响应、拒答、输入限制、费用和数据条件 |
| 2026-10-09 | [Decisions 与 Jev 对照](../investigations/openai-decisions-jev-comparison.md) | 质量、概率校准、延迟、成本及评测可比性 |
| 2026-10-15 | [Jev 1.14](../investigations/jev-1-14-capabilities-and-comparison.md) | 模型版本、图像、Box、长上下文与新版证据缺口 |

### 接入设计依据

以下三份报告形成于 2026-10-17，分别承接多模型接入形成时的设计依据；当前落实范围以包内接入合同和 CLI 为准，历史报告不作为运行入口。

| 调查 | 主要内容 |
| --- | --- |
| [JEV 载体到 OpenAI Decisions](../investigations/jev-carrier-openai-decisions-mapping.md) | 文本字段转换、顺序与精度、原始响应与统一结果、部分拒答 |
| [图片、Box 与长上下文](../investigations/decision-model-multimodal-long-context-integration.md) | 图像节点与通道传输、题目可见性、能力限制与实验开关 |
| [跨协议运行时](../investigations/lightweight-judgment-multi-protocol-runtime-boundaries.md) | 配置和凭据隔离、日志恢复、统计口径与验收 |

2026-10-17 的[OpenRouter 真协议取证](../investigations/openrouter-decision-live-protocols.md)分开记录直接 HTTP 探查与新版公开 CLI 的文本、嵌套图片、Box、有限长输入及临时日志／stats 贯通证据。有限样本只证明所列接收与贯通，不证明 Box 精度、整体质量或最大容量。原生 TypeSafe／OpenAI 仅有离线／mock 合同验证；OpenRouter 的指定 OpenAI 路由返回 403，具体原因、成功响应与拒答形状均未证。

接口兼容与目标任务效果分别验收。运行所需的转换与限制已集中在包内参考；维护时仍按目标版本核对来源、能力限制和未验证项。

## 验证责任

CLI 的本地验证边界见操作契约；模型的输入风险与任务验证方法见对应引用。实际采用时，用目标任务验证分类与精确求值的分流、独立问题与依赖问题的拆分、缺证与技术失败的区分，以及外发和高风险动作的权限边界。
