# Lightweight Judgment

`lightweight-judgment` 是按需点名使用的能力：用户明确指定该 skill 后，agent 才用 JEV 完成分类、候选选择、相关性筛选、命题判断和程度评分。适合输出空间明确、需要语义理解、结果可复核或回退的局部任务。

## 使用方式

在任务中点名 `$lightweight-judgment` 即可显式调用。包内 [agents/openai.yaml](../../skills/lightweight-judgment/agents/openai.yaml) 将 Codex 的 `policy.allow_implicit_invocation` 设为 `false`，使安装后的 skill 按此方式启用。

agent 负责选择局部任务、组织输入、复核结果并继续原任务；CLI 负责本地检查、离线预览、单次请求和机械响应校验。默认通道是 OpenRouter JEV，也可配置兼容 System One 的完整地址、密钥与 JEV 型号。

调用日志默认关闭。手动开启后，本地 SQLite 保存调用状态及选定的请求／响应正文，供进程中断后核对和后续统计；每次 CLI 仍直接调用，不自动重放。

skill 包含行为文档、自包含 CLI／source map、Codex 调用策略与通用 updater。分发后使用 Node.js 直接运行；仓库内可从 `bun run lightweight-judgment -- --help` 开始。

## 阅读入口

- [SKILL.md](../../skills/lightweight-judgment/SKILL.md)：agent 执行入口，承接任务选择、请求构造、结果复核与采用。
- [CLI 操作契约](../../skills/lightweight-judgment/references/cli.md)：运行前置、配置、输入输出、响应校验与技术失败。
- [调用日志](../../skills/lightweight-judgment/references/call-logging.md)：可选 SQLite 留存、调用状态、恢复与统计。
- [JEV 特点与实测依据](../../skills/lightweight-judgment/references/jev-characteristics.md)：具体任务、样本条件、观察结果和外推边界。

## 验证责任

CLI 的本地验证边界见操作契约；模型的具体历史实测、样本条件和外推边界见 JEV 证据。实际采用时，用目标任务验证分类与精确求值的分流、独立问题与依赖问题的拆分、缺证与技术失败的区分，以及外发和高风险动作的权限边界。
