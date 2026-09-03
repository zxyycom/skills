# Tasks

本 Plan 先使 preview、唯一 identity、runtime 和支持 profile 可实现，再以最少的 deterministic 与 Luna 证据完成验收；勾选只记录实际完成的工作。

## Readiness
- [x] 0.1 审阅 `initializer.ts`、`shared.ts`、`runtime.ts`、生成 YAML、现有 bridge tests 与 `mcpshell-workspace-bridge` test-evidence，确认 action plan、single-env/owned-identity conflict、partial/missing config、output limit 和 mode deadline 的最小入口及 case 粒度。
- [x] 0.2 在不安装依赖的前提下检查验收环境中的 `mcpshell --version`、`mcpshell validate --help`、`mcpshell mcp --help` 与 `codex mcp/exec --help`；记录 binary 缺失或实际版本，确认 host profile 与可运行的 smoke 命令。`MCPSHELL_BIN` 可以指向预先置于隔离临时目录的官方 binary，但本 Plan 不下载或安装它。
- [x] 0.3 确认本 Change 不涉及 directory sync、自动安装、SSH credential 管理、启动期绑定/热切换、第五个 tool、profile 或独立 status/doctor，并确认 `docs/decisions/validate-mcpshell-ai-behavior-with-luna.md` 的一次 Luna 上限适用。

## Implementation
- [x] 1.1 在 initializer 实现并测试无敏感值的 initialization plan/actions；让 preview/apply 使用同一 plan、保留 owned-table conflict/remove 边界，且只写实际改变的 env/TOML resource。
- [x] 1.2 实现并测试三项 flags 全给或全省略两种 config 选择：全省略时验证已有 env 并恢复受管 registration，部分/缺失/无效输入在任何写入前失败。
- [x] 1.3 限制每个 skill 安装只有一个 active owned identity：在 preview/apply 计算 plan 前发现另一受管 identity 时返回 `config_conflict` 且 env/TOML 均不变；保留精确 remove 供清理旧 identity 后切换。所有可预测 env/TOML 失败必须在首个写入前完成 preflight，不建设跨文件事务或极端崩溃 rollback。
- [x] 1.4 在 shared/runtime result contract 增加 `output_limit`，按 shell/patch 110 秒、put/get 290 秒选择 helper default，并对 captured stdout/stderr 实施 1 MiB 上限、process-group 终止和 stream/limit evidence；不改变 get 的原始文件流及现有 file semantics。
- [x] 1.5 调整生成 YAML、runtime tests 与 distribution tests，验证 YAML outer timeout 与 mode default 的预算关系、output-limit envelope、无界输出不会累积，以及现有 target/timeout/transport/file 契约仍成立。
- [x] 1.6 增加一个显式 `MCPSHELL_BIN` opt-in 的原生 integration test 与最小 stdio JSON-RPC test helper：validate、initialize、tools/list、一次只读 shell、正常 shutdown；该变量只接受现有 binary（可为隔离临时下载的官方文件），缺 binary 时只 skip，不下载、安装或调用写操作。
- [x] 1.7 同步生成 MJS/source maps/YAML、`SKILL.md` 和 `docs/skills/mcpshell-workspace-tools.md`，写明 initializer actions/env 恢复、单一 active owned identity、1 MiB 文本限制、compatibility profile、显式 smoke 与一次 Luna 边界；保持当前已完成的 skill version `4`→`5`，不得升至 `6`。
- [x] 1.8 为本次新增或保留的 initializer action/recovery、initializer singleton-identity conflict、runtime、opt-in smoke 最小原生测试入口分别新增或更新 `MCPSHELL-BRIDGE-*` case，并从 catalog 同步全局派生索引。
- [x] 1.9 修复 put 在 remote final commit 后发生 1 MiB stderr overflow 时将可能已提交 destination 误报为 `output_limit` 的 blocker：返回带 destination、bytes、SHA-256、`cause: "output_limit"`、stream、limit 的 `outcome_unknown`；已知预提交失败且没有 final metadata 时保持 `output_limit`，并以 `MCPSHELL-BRIDGE-RUNTIME-003` 记录该最小入口。

## Verification
- [x] 2.1 已运行 bridge target tests、generated/distribution tests、`bun run check:mcpshell-workspace-bridge`、skill validation、test-evidence catalog check、单 Change/decision check、typecheck、lint、format check 与适用的 `bun run check`；均通过，未发现测试失败、生成物不一致或结构检查失败。
- [x] 2.2 已以已有官方 v0.2.0 binary 显式运行最小 smoke；记录版本、validate、stdio initialize/list 与一次只读 shell call 的通过结果；未下载、安装或降级 binary。
- [x] 2.3 已在 smoke 通过后以 `codex exec --ephemeral --ignore-user-config -m gpt-5.6-luna --sandbox read-only` 执行一次隔离自然只读任务；记录相应 `workspace_shell` 选择、MCP approval policy 阻止调用及未完成任务。该失败是唯一一次执行的有效记录，**不是** AI 行为验收通过；不重试、不切换模型。
- [x] 2.4 独立 reviewer PASS 已复核 proposal success criteria、生成物与文档一致性、test-evidence 一入口一 case，以及 fixture / mechanical smoke / Luna evidence 的明确边界；未运行的真实环境条件与不支持范围已记录。
