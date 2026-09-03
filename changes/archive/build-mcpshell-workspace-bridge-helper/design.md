# Design

本 Plan 以小型 Node runtime 收口 agent 项目配置、MCPShell 参数模板和 SSH 数据通道。Node 仅在 agent 侧运行；backend 是已有 SSH handle 可达的 POSIX shell 环境。AI 的主线始终是取得固定 root 的四项 tools、按操作选择并继续原任务。

## Context

- 核心 [`mcpshell-workspace-tools`](../../skills/mcpshell-workspace-tools/SKILL.md) 拥有 AI 对 shell、apply-patch、put、get 的选择规则；agent 项目保存 skill、项目级 `.codex/config.toml` 与本机 env，目标 project root 不保存 agent 配置。
- MCPShell definitions 将参数交给 Node helper；helper 以 JSON envelope 保存目标失败证据，因此调用方无需从 MCPShell 外层状态猜测 operation 结果。
- 隔离 SSH fixture 验证 argv、stdin、目标退出状态和字节协议。它不验证真实 sshd、已安装 MCPShell binary 或 Codex reload。

## Goals / Non-Goals

目标：

- 默认预览，显式授权后才维护 agent 项目内受管 MCP table 与 `.env.mcpshell`。
- 分发可由 Node 直接执行的 initializer 与 runtime；Bun 只用于仓库构建和测试。
- 固定 backend、project root 与 staging root；command/patch 保持完整字符串，put/get 传输单个常规文件的原始字节。
- 用稳定 envelope、byte count 和 SHA-256 让 AI 能判断目标失败、传输失败、完成与不确定提交。

非目标：

- 不管理 SSH 凭据、账号、daemon、生产配置、目标工作区生命周期、递归传输或目录同步。
- 不提供独立 read/diff tool、通用 backend registry 或远端 API。
- 不将 fixture 协议证据表述为真实 sshd、MCPShell binary 或 Codex reload 的验证。

## Decisions

### Intended Change

#### Distribution and startup binding

维护源码位于 `tools/mcpshell-workspace-bridge/`；根构建将 initializer、runtime、source map 与 MCPShell YAML 生成到 `skills/mcpshell-workspace-tools/`。生成模块可 import 而不产生副作用，作为主模块时可由 Node 执行；运行时依赖 Node 内置模块和系统 `ssh`。

initializer 从自身 `import.meta.url` 定位安装拓扑，在 `<agent-project>/skills/mcpshell-workspace-tools/` 中读取相邻资源。`preview` 是默认命令；`apply` 写入同目录 env，并仅维护带 `# Managed by mcpshell-workspace-bridge: <identity>` 标记的 `[mcp_servers.<identity>]` table。已有同名但非受管 table 返回 `config_conflict` 而不改写。`remove` 仅移除同一受管 table，`--remove-env` 才移除 env。

配置 table 使用项目相对 YAML 路径；`.env.mcpshell` 保存 backend handle、POSIX absolute project root 与 agent-platform absolute staging root。server 启动时读取并验证这些值，随后不再从 tool schema 接收 workspace 路径。

#### Four operations and result contract

| Tool | MCP 输入 | 结果判断 |
| --- | --- | --- |
| `workspace_shell` | 完整 `command` 字符串 | stdout、stderr、目标退出状态、timeout 或 transport failure |
| `workspace_apply_patch` | 完整 unified diff `patch` 字符串 | 固定 project root 中的一次整体应用结果 |
| `workspace_put_file` | 两端相对路径与 `replace` | project root 中的原子落盘、byte count 与 SHA-256 |
| `workspace_get_file` | 两端相对路径与 `replace` | staging root 中的原子落盘、byte count 与 SHA-256 |

definitions 以模板化 `run.env` 调用 Node runtime；command/patch 限制为 64 KiB，文件内容不进入 MCP 文本参数或环境变量。runtime 仍验证所有输入，并始终输出 envelope、外层退出 0。成功时 `failure_kind` 为 `null`；目标失败、timeout、transport failure、路径/容量/配置拒绝和目标文件已存在保留各自稳定分类。

command 与 patch 通过 SSH stdin 交给目标的单一消费者。shell/patch 通过状态 marker 区分目标 exit 255 与无 marker 的 transport failure。patch 以单次 `git apply` 完成，失败不保留部分 hunk。put/get 仅处理常规非 symlink 文件，接收端临时校验 byte count 和 SHA-256 后原子提交。

#### Root and uncertain-commit boundary

固定 roots 拒绝绝对路径、`..`、`.git` 与越界 symlink。它们防止误操作，不能作为同一 OS/SSH identity 恶意并发 rename 的安全 sandbox；该 identity 已可通过 shell 操作 root 可见内容。

remote put 在已验证的目标 parent 中提交，local get 在 canonical staging parent 中提交；提交前检测到 containment 失败会清理 helper temporary 并返回 `path_rejected`。final commit 后确认丢失时不能安全回滚或按 basename 猜测所有权：返回 `outcome_unknown`，携带 destination、预期 bytes 和 SHA-256，由调用方核验后决定重试。

backend 需要 POSIX `sh`、`git apply`、`mktemp`、`wc` 和 `sha256sum` 或 `shasum -a 256`。

### Resulting Impacts

- **核心 skill/docs：** 主线是固定 root、工具选择、失败恢复与继续原任务；初始化仅提供必要的 agent 项目配置事实。
- **构建与分发：** initializer、runtime、source map 与 YAML 随同 skill 分发；分发运行时不依赖 Bun。
- **配置：** 跟踪配置只保存项目相对 resource 路径，本机连接与 roots 留在受 ignore 的 env；受管 marker 保护现有 MCP entries。
- **验证边界：** tests 使用隔离可执行 SSH fixture 验证 command stdin 保真、patch 整体性、目标 exit 255、timeout、transport failure、路径边界、文件 byte/hash、原子提交、清理和 `outcome_unknown`。真实 sshd、已安装 MCPShell binary 与 Codex reload 由使用环境验证。

## Risks / Trade-offs

| 风险 | 当前处理 |
| --- | --- |
| MCPShell 外层丢失失败输出 | helper 总输出 JSON envelope；调用方读取 operation 证据而非外层退出状态。 |
| 配置合并误伤现有内容 | 受管 marker、同名冲突停止与精确移除；fixture 比较无关 TOML bytes。 |
| 文本参数容量 | command/patch 在 64 KiB 前拒绝；文件内容走 SSH 字节流。 |
| 文件提交确认丢失 | 返回 `outcome_unknown` 与预期 metadata，先核验后决定重试。 |
| 环境差异 | 第一版公开限定 POSIX backend；真实部署依赖由使用环境验证。 |

## Open Questions

没有阻塞本 Plan 的产品或实现选择。真实 sshd、实际安装的 MCPShell binary 与 Codex 会话 reload 是使用环境的验证边界，不改变本仓库已验证的 runtime 与 fixture 契约。
