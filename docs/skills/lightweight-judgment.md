# Lightweight Judgment

`lightweight-judgment` 让 agent 使用 JEV 完成分类、候选选择、相关性筛选、命题判断和程度评分，再把结构化结果用于原任务。适合输出空间明确、需要语义理解、结果可复核或回退的局部任务。

内容按职责组织：

- [SKILL.md](../../skills/lightweight-judgment/SKILL.md)：任务选择、JEV 特点摘要，以及构造请求、调用、检查与采用结果的流程。
- [CLI 操作契约](../../skills/lightweight-judgment/references/cli.md)：配置、JSON／参数输入、离线预览、响应校验与技术失败。
- [JEV 特点与实测依据](../../skills/lightweight-judgment/references/jev-characteristics.md)：具体任务、样本分母、观察结果和外推边界，供按需查阅。

## 使用与交付

skill 包括行为文档、自包含 `scripts/lightweight-judgment.mjs`／source map 与通用 updater。CLI 通过固定 OpenRouter JEV 通道发送单次请求，提供本地前置诊断、完整 JSON 与单题参数输入、离线预览和机械响应校验。

分发后按 [CLI 操作契约](../../skills/lightweight-judgment/references/cli.md) 使用 Node.js 直接运行；仓库内可从 `bun run lightweight-judgment -- --help` 开始。

## 验证责任

CLI 的本地验证边界见操作契约；模型的具体历史实测、样本条件和外推边界见 JEV 证据。实际采用时，用目标任务验证分类与精确求值的分流、独立问题与依赖问题的拆分、缺证与技术失败的区分，以及外发和高风险动作的权限边界。
