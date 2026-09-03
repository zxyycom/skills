# Verification

本文件保存本 Change 已实际执行的验证。bridge fixture、真实 MCPShell smoke 与 Luna 行为调用证明不同事实，结论不能互相替代。

## Mechanical MCPShell smoke

- **环境**：维护者显式提供的官方 MCPShell v0.2.0 binary。
- **执行**：opt-in stdio smoke 依次完成 `validate --tools`、从隔离 agent project 启动 `mcp --tools`、JSON-RPC initialize/initialized、tools/list 与一次只读 `workspace_shell`。
- **结果**：通过（1 pass）。tools/list 返回四项 workspace tools；只读 shell 在固定 target root 返回预期 stdout。
- **边界**：该 smoke 不调用 patch、put 或 get，也不证明其他 binary 的兼容性；其他 binary 仍须显式运行同一 smoke。

## Put post-commit output limit

- **入口**：`MCPSHELL-BRIDGE-RUNTIME-003`；隔离 SSH 在 remote put final commit 后令 stderr 超过 1 MiB。
- **结果**：返回 `outcome_unknown`，而非普通 `output_limit`。evidence 保留 destination、预期 bytes、SHA-256、`cause: "output_limit"`、stream 与 limit；目标文件与 source bytes 一致。
- **恢复**：可确认的预提交失败且没有 final metadata 时仍为 `output_limit`。`outcome_unknown` 必须先按 destination 和 SHA-256 核验，不能直接 replace 重传。

该入口保留 1 MiB output capture 边界，同时不把可能已经提交的 destination 误导为安全重试。

## 最终预归档检查

- **分发同步**：运行 `bun run sync:mcpshell-workspace-bridge`，更新 optimizer 后 initializer 的 `.mjs` 与 source map；随后的 generated check 通过，无生成漂移。
- **Bridge 与结构检查**：`bun run test:mcpshell-workspace-bridge` 为 33 pass、1 skip、0 fail；skip 是未设置 `MCPSHELL_BIN` 的 opt-in stdio smoke。本轮未重跑真实 MCPShell smoke 或 Luna。skill validation、test-evidence catalog（751 cases）、单 Change check、decision check、typecheck、lint 与 format check 均通过。
- **全仓检查**：`bun run check` 完成，32 passed、0 failed、28 unavailable（release tag 未启用）；function/file metrics 仅报告非阻断 warning，不影响该检查通过。

因此 tasks 的 2.1 已完成；最终语义复核见下节。本 Change 在归档前仍为 Plan。

## 最终语义复核

独立 reviewer 给出 **PASS**：proposal 的成功标准、生成物与 skill/docs 的语义、test-evidence 的一入口一 case，以及 fixture、真实 MCPShell smoke 与单次 Luna 调用之间的证据边界均已复核。Luna 的 approval-policy 阻断继续仅作为未完成任务的失败记录，不被表述为通过；未重复真实 smoke 或模型调用。

## 单次 Luna 行为调用

- **执行**：在 mechanical smoke 通过后，对隔离 fixture 运行一次 `codex exec --ephemeral --ignore-user-config -m gpt-5.6-luna --sandbox read-only` 自然只读任务。
- **工具选择**：Luna 选择 `luna_workspace_bridge.workspace_shell`，command 为 `sed -n '1p' TARGET_SENTINEL.md`；未选择 patch、put 或 get，符合只读任务。
- **任务结果**：非交互 approval policy 返回 `MCP tool call requires approval, but approval policy is never`，因此未读取 sentinel、原任务未完成。agent、target 和 staging 的哈希未改变。
- **结论**：这只提供正确 tool 选择的信号，不证明 tool 执行、任务收尾或 AI 行为验收通过。没有第二次模型调用、没有更换模型或 prompt 补测。

任务完成的未来 AI 验证须在 smoke 已通过、Codex auth 可用且 approval policy 允许 MCP `tools/call` 时进行，并仍遵守一次调用上限。

## 当前结论

| 证据 | 状态 | 证明范围 |
| --- | --- | --- |
| bridge fixture | 通过 | argv、stdin、失败、字节协议和确定性 runtime 契约 |
| MCPShell v0.2.0 stdio smoke | 通过 | 当前生成 YAML、server、tool list 与一次只读 shell call |
| 一次 Luna 调用 | 已执行，任务未完成 | 正确 shell 选择信号；approval 未允许，因此不证明 task completion |
