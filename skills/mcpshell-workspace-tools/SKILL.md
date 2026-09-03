---
name: mcpshell-workspace-tools
description: >-
  当 AI 在保存个人规则和 skills 的 agent 项目中工作，却需要操作另一个隔离的
  项目工作区时，使用 MCPShell 建立或恢复绑定固定工作区的 shell、apply-patch 与
  双向单文件 tools。查看文件和执行命令优先用 shell，修改文本优先用 patch，
  put/get 只传输文件实体；已有等价 workspace tools 时直接使用。
metadata:
  version: "4"
---

# MCPShell Workspace Tools

## 主承诺

让 AI 从 **agent 项目** 操作一个固定的 **目标 project root**，同时保留 agent 项目中的个人规则、skills 和项目级 MCP 配置。backend 屏蔽目标位于同机、容器或远端的差异；AI 只需按操作选择四项 tools，然后继续原任务。

```text
agent project (rules, skills, MCP registration)
  -> workspace tools -> backend -> fixed target project root
```

这四项 tools 是便捷入口，不是排他路由。已验证作用于同一 project root 且更适合当前操作的其他工具可以直接使用。

## 选择 tool

| 当前操作 | 首选 tool | 以什么判断完成 |
| --- | --- | --- |
| 查看文件、运行命令、构建、测试、Git status/diff | `workspace_shell` | 目标 stdout、stderr、退出状态与当前 root |
| 创建、更新或删除文档和其他文本 | `workspace_apply_patch` | unified diff 的整体应用结果及受影响路径 |
| 把 agent 侧已形成的文件实体放入项目 | `workspace_put_file` | 两端路径、byte count、SHA-256 |
| 把项目文件实体取到 agent staging | `workspace_get_file` | 两端路径、byte count、SHA-256 |

普通查看使用 shell；文本编辑先读取上下文后提交最小 patch，并用 shell 查看内容和 Git diff。put/get 只用于单个文件实体（例如二进制、较大文件或已生成产物），不替代浏览或文本编辑。

## 读取结果与失败

- `workspace_shell(command)` 的 backend handle 和 project root 已在 server 启动时绑定。MCP 调用返回不等于目标命令成功：根据 stdout、stderr、目标退出状态、`timeout` 或 `transport_failure` 判断。所有 operation result 都标识 operation、`ok`、`failure_kind`、target 和相应证据。
- `workspace_apply_patch(patch)` 接收完整 unified diff，并在固定 project root 中整体应用。失败不是可接受的部分文本修改；成功后仍用 shell 核验实际内容和 diff。
- `workspace_put_file(source_path, destination_path, replace=false)` 从 agent staging 写入 project root；`workspace_get_file(...)` 方向相反。路径均相对各自 root，默认不替换现有文件。成功时以两端 SHA-256 和 byte count 一致为准。
- put 返回 `outcome_unknown` 表示 final destination **可能已提交**，但最终确认丢失。结果提供 destination、预期 bytes 和 SHA-256：先用 `workspace_shell` 在目标核验路径和 SHA-256，再按结果决定是否重试；不得直接以 `replace=true` 覆盖重传。

## 建立或恢复 tools

### 1. 保留原任务并检查现有 tools

1. 记录初始化后要继续的原任务，确认目标 project root。
2. 若已有 tools 已能证明绑定到该 root 并返回可判断的失败语义，直接进入“继续原任务”。

### 2. 从 agent 项目恢复配置

本 skill 安装在 agent 项目；目标 project root 只保存目标项目内容。配置位置与责任如下：

| 位置 | 保存内容 |
| --- | --- |
| agent 项目的 `.codex/config.toml` | MCP server 注册和包内相对入口 |
| 本 skill 同目录的 `.env.mcpshell` | 本机 backend handle、目标 project root、agent staging root |
| 同目录 `.gitignore` 与 `.env.mcpshell.example` | 忽略真实本机 env；提供可跟踪的字段说明 |

server identity 是用于创建、恢复和精确移除这组 tools 的稳定名称。project root 是 backend 所见的目标项目绝对路径；staging root 是 agent 环境的任务交换区。两者随 server 启动实例固定，不作为日常 tool 参数。只询问缺失且会改变目标的值；不要把本机路径或连接信息写入跟踪配置。

### 3. 预览，再在授权后写入

本包分发 Node initializer、runtime helper 与四项 MCPShell definitions。**在本 skill 目录中**先运行默认只读预览：

```text
node scripts/init-mcpshell-workspace.mjs preview --identity <server-identity> --backend <ssh-host-or-alias> --project-root <remote-posix-absolute-root> --staging-root <local-absolute-root>
```

只有当前任务明确授权修改 agent 项目时，才将同一命令的 `preview` 改为 `apply`。initializer 写入本机 env，并仅维护带自身拥有标记的 `[mcp_servers.<identity>]` table；同名但非本 bridge 所有的 table 会停止而不覆盖。移除须由用户明确请求：使用 `remove --identity <server-identity>`；只有同时传入 `--remove-env` 才删除本机 env。

初始化使用已安装的 MCPShell 和系统 `ssh`；不安装 MCPShell、不修改 SSH 凭据、用户目录或目标项目。上述任一扩大范围的操作都需要对精确对象的授权。

### 4. 在运行时验证后继续

1. 从运行时确认四项 callable tools。
2. 用 `workspace_shell` 检查当前目录和 `git rev-parse --show-toplevel` 均为目标 project root，并用一个只读非零命令确认目标失败证据仍可见。
3. 真实 patch 或文件传输只随原任务发生，不为初始化制造目标项目改动。
4. 如需会话 reload，交接原任务、server identity、project root、staging root 与预期 tool names；重载后重复本步骤。

## 操作与验证边界

1. shell、patch 与 file paths 受固定 roots 约束；staging 只保存当前任务明确需要的交换文件。绝对路径、`..`、`.git` 内部路径、静态或操作时观测到的越界 symlink 和非普通文件 source 会被拒绝。
2. roots 防止误操作，不是对同一 OS/SSH identity 恶意并发 rename 的安全 sandbox；该 identity 本就可借 shell 操作 root 所见文件。
3. command/patch 超过 64 KiB 会在连接前拒绝。patch 只有所有目标成功才算完成。文件传输只有 `failure_kind` 为 `null`、byte count 与两端 SHA-256 一致才算完成；提交前失败不留下 helper temporary。
4. get 的 source 必须由原任务正当化；凭据、secret 和无关项目内容需要单独依据。
5. backend 需要 POSIX `sh`、`git apply`、`mktemp`、`wc` 和 SHA-256 工具。仓库的隔离 SSH fixture 已验证 argv、stdin、失败和字节协议；真实 sshd、已安装 MCPShell binary 与 Codex reload 必须在使用环境另行验证。

## 完成标准

1. AI 能区分 agent 项目、目标 project root 与 agent staging root，并从正确位置恢复注册和本机配置。
2. 四项 tools 的实际名称和固定 roots 已恢复；shell 的 root 与失败结果已验证。
3. 后续查看、修改与传输按“选择 tool”执行，目标项目只收到原任务要求的内容。
4. 原任务已继续；会话 reload、真实 sshd、MCPShell binary 的实际可用性按使用环境事实交付。
