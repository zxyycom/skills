# Design

本 Change 以 AI 的实际使用路径组织配置：agent 项目从本机配置绑定一个固定目标工作区，AI 随后只需选择四项 workspace tools。目标在同机、容器或远端不会改变这条路径。

## Context

- `mcpshell-workspace-tools` 安装在 agent 项目中；agent 项目保存个人 rules、skills 和 MCP 注册，不等于多人协作的目标工作区。
- backend 处理目标工作区的位置；AI 的 tools 只面对已绑定的 project root。
- 跟踪的 MCP registration 与本机绝对路径、连接标识分离：前者在 agent 项目 `.codex/config.toml`，后者在 skill 同目录 `.env.mcpshell`。
- 关联 bridge 已分发 Node runtime、MCPShell definitions、patch 与双向文件传输；核心 skill 负责 AI 如何选择和恢复这些能力。

## Goals / Non-Goals

目标：

- 让 AI 从核心 skill 恢复 agent 项目、目标工作区、staging 与 backend 的关系。
- 明确项目内 MCP registration、机器本地配置和可分发资源的 owner。
- 保持工具选择、初始化授权、失败恢复和环境验证边界的一条主线。

非目标：

- 不写入真实 `.env.mcpshell`、`.codex/config.toml`、SSH 配置或目标工作区。
- 不新增用户级 MCP 注册、远端常驻服务、目录同步或通用 remote execution platform。
- 不替代关联 bridge 对 runtime、transport 和 fixture 的实现验证。

## Decisions

### Intended Change

#### Project topology

```text
agent project/
├── .codex/config.toml
└── skills/mcpshell-workspace-tools/
    ├── .gitignore
    ├── .env.mcpshell.example
    ├── .env.mcpshell              # machine-local, untracked
    ├── scripts/
    │   ├── init-mcpshell-workspace.mjs
    │   └── mcpshell-workspace.mjs
    └── references/mcpshell-tools.yaml

backend -> fixed target project root
```

`.codex/config.toml` 只保存项目相对的 MCP registration。`.env.mcpshell` 保存 `MCPSHELL_BACKEND_HANDLE`、`MCPSHELL_PROJECT_ROOT` 与 `MCPSHELL_STAGING_ROOT` 的本机值；同目录 `.gitignore` 精确排除它，example 只说明字段和路径视角。目标工作区不保存 agent 的 skill、Codex 配置或 bridge 配置。

#### Startup and tool data

provider 以 Node `.mjs` 随 skill 分发，并用自身 `import.meta.url` 定位相邻资源。initializer 先预览；明确授权 apply 时，仅维护当前 identity 拥有的 agent 项目 MCP table，并将 backend、project root 与 staging root 绑定到 server 启动实例。

| Tool | MCP 输入 | 数据去向 |
| --- | --- | --- |
| `workspace_shell` | 完整 `command` 字符串 | SSH stdin 到目标 shell |
| `workspace_apply_patch` | 完整 unified diff `patch` 字符串 | SSH stdin 到固定 project root 的 Git apply |
| `workspace_put_file` | 两端相对路径与 `replace` | staging 原始字节流向 project root |
| `workspace_get_file` | 两端相对路径与 `replace` | project root 原始字节流回 staging |

command/patch 是文本字符串；文件内容不进入 MCP 文本参数。server 启动后，日常 tool schema 不再次接收 workspace 路径。

### Resulting Impacts

- **核心 skill：** 主线是恢复固定 tools、选择 tools、判定结果并继续原任务；初始化仅说明完成该路径需要的配置事实。
- **配置资源：** 真正的 `.env.mcpshell` 保持本机未跟踪，example 与 ignore rule 随 skill 分发。
- **分发与版本：** Node initializer、runtime helper 与 MCPShell definitions 已在同一 skill 包中；version `4` 已覆盖配置和 bridge 契约。
- **验证：** fixture 证明 runtime 协议；真实 sshd、已安装 MCPShell binary 与 Codex reload 仍由使用环境验证。

## Risks / Trade-offs

| 风险 | 当前处理 |
| --- | --- |
| 本机绝对路径或 backend 信息被提交 | `.gitignore` 精确排除 `.env.mcpshell`；example 不含真实值。 |
| AI 混淆 agent 项目与目标工作区 | 术语、拓扑和完成检查始终分别命名两处。 |
| 项目级配置覆盖现有 MCP entry | initializer 仅维护拥有标记的 identity，冲突时停止，写入前预览。 |
| 文本/文件通道被混用 | command/patch 是完整字符串；put/get 承担单文件原始字节。 |

## Open Questions

没有阻塞本 Change 的产品或契约决策。关联 bridge 的 fixture 验证运行时协议；真实 sshd、MCPShell binary 与 Codex reload 需要在使用环境另验。
