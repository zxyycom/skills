# Proposal

本 Change 在不改变四项 tools 或固定 workspace 绑定模型的前提下，完善 `mcpshell-workspace-tools` 的初始化恢复、运行时资源边界与真实验证路径。目标是让 AI 和维护者能在实际文本中恢复推荐操作、可判断失败与证据边界。

## Why

初始化需要在授权前显示准确的 env 与 MCP registration 改动，并能从既有有效 env 恢复 registration。每个安装还需要防止多个受管 identity 共享单例 env。

runtime 需要让内部 deadline 与已分发 YAML 的 operation timeout 协调，并对返回给 MCP 的 stdout/stderr 设定有界、可恢复的结果语义。fixture 证明 bridge 协议；真实 MCPShell stdio 与 AI 是否按 skill 选择 tools 需要独立、低频的证据。

## Outcome

initializer 以无敏感值的 action plan 支持 preview、apply 和恢复；每个安装只保留一个 active owned identity。runtime 为 shell/patch 和 put/get 使用相应的 deadline，并将文本输出超限明确返回为 `output_limit` 或 put 的 `outcome_unknown`。skill 说明支持 profile、机械 smoke 与一次 Luna 行为验证各自证明的范围。

## Scope

### Intended Change

- preview/apply 共享只读 initialization plan，对 env 与受管 registration 分别返回 `create`、`update` 或 `unchanged`；preview 不写入，apply 只执行实际变更。
- 三项配置 flag 全部提供，或全部省略并从有效 `.env.mcpshell` 恢复 registration；部分、缺失或无效输入在写入前失败。
- 每个安装仅一个 active owned identity；存在另一受管 identity 时返回 `config_conflict`，先精确 remove 旧 identity 才能切换。
- shell/patch 使用 110 秒 helper deadline，put/get 使用 290 秒；captured stdout/stderr 各限制为 1 MiB，并提供稳定恢复语义。
- 维护 agent host、MCPShell 与 backend profile，以及 opt-in stdio smoke 和一次隔离 Luna 验证的证据边界。
- 同步生成 artifacts、skill/docs、最小原生 tests 与对应 test-evidence。

### Resulting Impacts

- caller 先审阅 initialization actions 再决定是否授权 apply；env 的恢复与 identity 切换不再依赖隐含状态。
- caller 将 `output_limit` 视为未获得完整文本输出；put 在可能提交后超限时先核验 destination、bytes 与 SHA-256，不能直接覆盖重传。
- fixture、真实 MCPShell smoke 与 Luna 行为验证是独立证据，任何一项都不替代另一项。
- skill 版本保持 `5`，不升至 `6`。

## Success Criteria

1. preview 准确显示无敏感值的 action 且不写入；apply 只执行计划中的变更。
2. 有效 env 可恢复 registration；非法配置在写入前返回可行动失败；另一 owned identity 阻止 preview/apply，精确 remove 后才能切换。
3. 110/290 秒 deadline 与 2m/5m YAML timeout 协调；stdout/stderr 各 1 MiB 的超限结果可判断。
4. 可能提交的 put output overflow 返回核验证据齐全的 `outcome_unknown`；已知未提交时仍为 `output_limit`。
5. 文档明确支持 profile、初始化、失败恢复和真实验证边界；真实 smoke 与 Luna 结果不被夸大。
6. 相关 mechanical checks、skill/Change/decision checks 与本 Change 要求的验证通过；Luna approval 未允许 `tools/call` 时不表述任务完成，也不重试。

## Affected Owners

- `tools/mcpshell-workspace-bridge/`：initializer、runtime、结果契约、原生测试与隔离 smoke helper。
- `scripts/build/mcpshell-workspace-bridge.ts` 与 `skills/mcpshell-workspace-tools/`：生成 artifacts、YAML、skill 行为入口、version `5` 与分发一致性。
- `docs/skills/mcpshell-workspace-tools.md`：面向人类的初始化、支持 profile 与验证边界。
- `docs/test-evidence/mcpshell-workspace-bridge/` 与其派生索引：最小原生测试证据。
- `docs/decisions/validate-mcpshell-ai-behavior-with-luna.md`：长期的模型验证频率与证据分工；本 Change 的实际一次调用结果由 `verification.md` 承接。
