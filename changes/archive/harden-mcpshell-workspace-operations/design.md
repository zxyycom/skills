# Design

本 Plan 不扩张 bridge 抽象或 tool 集合。它以一条操作主线收敛：先审阅并授权初始化，再按 operation 调用固定-root tools；调用方从 result 恢复成功、失败或可能提交，并以适合的证据验证真实环境。

## Context

- 核心 skill 已定义 agent project、target project 与 staging 的边界，且 `.env.mcpshell` 在每次 runtime 调用时读取；env 修改从下一次调用生效。
- 单例 env 承载 backend、project root 与 staging root，因此多个 owned registration 不能安全地共享它。
- YAML 外层 timeout 是 shell/patch 2m、put/get 5m；runtime 需要相应的内部 deadline 和受限文本输出。
- 隔离 fixture 覆盖 bridge 协议；已有 MCPShell v0.2.0 binary 已通过最小 stdio smoke。一次 Luna 调用只观察到正确的 shell 选择，approval policy 拒绝 `tools/call`，所以任务未完成。

## Goals / Non-Goals

目标：

- 让 preview 成为不泄露配置值的精确写入计划，并让有效 env 支持恢复 registration。
- 保持单一 active owned identity，阻止多个 registration 使用同一 env。
- 用 operation 对应的 deadline、1 MiB 文本上限和 `outcome_unknown` 恢复步骤保护调用方。
- 将 fixture、真实 MCP smoke 与一次 Luna 行为验证明确为不同证据。

非目标：

- 不增加 tool、directory sync、自动安装、credential 管理、远端 daemon、backend registry、identity profile 或独立 status/doctor 命令。
- 不改变 env 的按调用读取语义，也不把本 Change 的一次 Luna 上限扩张为模型、host 或版本矩阵。
- 不连接生产 backend、不写入真实用户配置或真实凭据。

## Decisions

### Intended Change

#### Initializer plan、恢复与唯一 identity

initializer 对 env 和受管 `[mcp_servers.<identity>]` registration 计算同一个只读 action plan。每项 action 是 `create`、`update` 或 `unchanged`，不含 backend、root、staging 或绝对安装路径；preview 永不写入，apply 仅写有变更的 resource。

config 输入只有两种合法形式：`--backend`、`--project-root`、`--staging-root` 全部提供，或三项全部省略并验证已有 env。部分输入、无效 env、definitions/ignore rule 前置条件失败或同名非受管 table 都在写入前失败。

任何请求 identity 之外的 owned identity 均返回 `config_conflict`，不写 env 或 TOML。用户明确授权后，`remove --identity <old-identity>` 精确移除旧 table，之后才能切换。所有可预测检查在写前完成；每个文件保持原子写入，但不承诺不可预测中断下的跨文件事务。

#### Runtime budget 与恢复语义

| Operation | helper deadline | YAML outer timeout |
| --- | --- | --- |
| shell / patch | 110 秒 | 2m |
| put / get | 290 秒 | 5m |

每项预算为 process termination、JSON envelope 与 MCP 返回保留余量。captured stdout 和 stderr 各限制为 1 MiB；超限时停止 SSH process group，返回 `output_limit`、stream 与 limit evidence，且输出前缀不能作为完整目标结果。get 的原始文件流不计入文本上限，但 stderr 仍受限。

put 若已进入可能 final commit 的阶段而 output overflow 使最终 metadata 不完整，返回 `outcome_unknown`，并保留 destination、预期 bytes、SHA-256、`cause: "output_limit"`、stream 和 limit。调用方先用 shell 核验 destination 与 SHA-256；只有确定未提交时才返回普通 `output_limit`。

#### 支持 profile 与验证分工

| 边界 | 条件 | 证明方式 |
| --- | --- | --- |
| Agent host | POSIX `/bin/sh`、Node、已有 MCPShell、系统 `ssh`，并从 agent project 解析 `skills/...` 相对 command | 安装与运行前检查 |
| Backend | `ssh -T` 可访问，具有 POSIX `sh`、`git apply`、`mktemp`、`wc` 与 SHA-256 工具 | bridge fixture 与使用环境核验 |
| MCPShell | 已有 binary 能 validate generated YAML 并完成 stdio initialize、tools/list、只读 shell call | 显式 opt-in smoke |
| Codex/AI | smoke 已通过、Codex auth 可用，非交互 approval policy 允许 MCP `tools/call` | 一次隔离 Luna 任务的 call log 与任务收尾 |

smoke 不为覆盖率调用 patch、put 或 get，也不下载、安装或替换 MCPShell。Luna 只验证机械入口无法证明的触发、tool 选择和任务延续；本 Plan 最多执行一次。approval policy 阻止 `tools/call` 时可记录选择信号，但不能证明任务完成，也不重试或换模型。

#### 同步与记录

source 改动按既有 build 路径同步 MJS、source maps 与 YAML。新增或调整的最小原生测试分别维护 `MCPSHELL-BRIDGE-*` case 与派生索引。skill/docs 保持 version `5`，说明 initialization actions、env 恢复、单一 identity、输出恢复、profile 和证据分工；实际 smoke/Luna 运行结果只记录在本 Change 的 `verification.md`。

### Resulting Impacts

- **initializer caller：** 先审阅精确 action，再决定 apply；从有效 env 恢复 registration，或先精确 remove 后切换 identity。
- **tool caller：** `output_limit` 后缩小命令、定向读取或选择符合任务的操作；put 的可能提交需先核验，不直接 replace 重传。
- **维护者：** fixture、MCP smoke 与 Luna 结论分别交付。真实 smoke 的通过不证明 AI 行为；Luna 的未完成不改变机械 smoke 结论。
- **分发：** artifacts 继续随 skill 分发，不携带 MCPShell binary、credential 或 host installation 内容。

## Risks / Trade-offs

| 风险 | 当前处理 |
| --- | --- |
| 大量日志占用 helper 内存 | stdout/stderr 各 1 MiB，返回可判断 `output_limit`。 |
| 较长操作被 helper 过早终止 | 110/290 秒预算与 2m/5m outer timeout 协调。 |
| 过时 env 恢复错误连接 | 仅在三项 flag 全省略且 env 有效时复用；apply 后重新核验 root。 |
| 多 registration 共享单例 env | 另一 owned identity 在写入前触发 `config_conflict`。 |
| final commit 后确认丢失 | 返回 `outcome_unknown` 和核验证据，不猜测回滚或覆盖。 |
| 非交互 approval 拒绝 MCP call | 记录选择信号和未完成任务；不重试，不把它记为通过。 |

## Open Questions

没有阻塞实现问题。真实 MCPShell compatibility 仍按行为门槛逐个 binary 执行 smoke 验证；非交互 Luna 若要证明任务完成，approval policy 必须允许 MCP `tools/call`。
