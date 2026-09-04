---
name: mcpshell-workspace-tools
description: >-
  当 AI 在保存个人规则和 skills 的 agent 项目中工作，却需要操作另一个隔离的
  项目工作区时，使用 MCPShell 建立或恢复绑定固定工作区的 shell、apply-patch 与
  双向单文件 tools。查看文件和执行命令优先用 shell，修改文本优先用 patch，
  put/get 只传输文件实体；已有等价 workspace tools 时直接使用。
metadata:
  version: "6"
---

# MCPShell Workspace Tools

## 主承诺

让 AI 从 **agent 项目** 操作固定的 **目标 project root**，同时保留 agent 项目中的个人规则、skills 和项目级 MCP 配置。backend 屏蔽目标位于同机、容器或远端的差异；AI 取得 tools 后按操作选择并继续原任务。

```text
agent project (rules, skills, MCP registration)
  -> workspace tools -> backend -> fixed target project root
```

四项 tools 是便捷入口，不是排他路由；已验证作用于同一 project root 且更适合当前操作的其他工具可以直接使用。

## 选择 tool

| 当前操作 | 首选 tool | 完成证据 |
| --- | --- | --- |
| 查看文件、运行命令、构建、测试、Git status/diff | `workspace_shell` | 目标 stdout、stderr、退出状态与当前 root |
| 创建、更新或删除文档和其他文本 | `workspace_apply_patch` | unified diff 的整体应用结果及受影响路径 |
| 把 agent 侧已形成的文件实体放入项目 | `workspace_put_file` | 两端路径、byte count、SHA-256 |
| 把项目文件实体取到 agent staging | `workspace_get_file` | 两端路径、byte count、SHA-256 |

普通查看使用 shell。文本编辑先读取上下文后提交最小 patch，再用 shell 查看内容和 Git diff。put/get 仅传输单个文件实体（例如二进制、较大文件或已生成产物），不替代浏览或文本编辑。

## 建立或恢复 tools

### 1. 保留原任务并恢复位置

1. 记录初始化后要继续的原任务，确认目标 project root。
2. 若现有 tools 已证明绑定到该 root 且返回可判断的失败语义，直接进入“继续原任务”。
3. 否则从安装本 skill 的 agent 项目恢复配置：

| 位置 | 保存内容 |
| --- | --- |
| agent 项目的 `.codex/config.toml` | MCP server 注册和包内相对入口 |
| 本 skill 同目录的 `.env.mcpshell` | backend handle、目标 project root、agent staging root 的本机值 |
| 同目录 `.gitignore` 与 `.env.mcpshell.example` | 忽略真实 env；提供可跟踪的字段说明 |

server identity 是创建、恢复和精确移除这组 tools 的稳定名称。project root 是 backend 所见的目标项目绝对路径；staging root 是 agent 环境的任务交换区。runtime 每次调用读取 env，因此 env 修改从**下一次调用**生效；修改后先重新核验 root。不要把本机路径或连接信息写入跟踪配置。

### 2. 先审阅 action，再在授权后 apply

一个 skill 安装只有一个 `.env.mcpshell`，因此只允许一个 active bridge-owned identity。请求 identity 之外已有 owned table 时，`preview` 和 `apply` 都以 `config_conflict` 停止，不写 env 或 TOML；需在用户明确授权下用 `remove --identity <old-identity>` 精确移除旧 table，才可切换 identity。

**在本 skill 目录中**先运行只读 preview。配置输入只有两种合法形式：三项 flag 全部提供，或三项都省略并从有效 env 恢复 registration。

```text
node scripts/init-mcpshell-workspace.mjs preview --identity <server-identity> --backend <ssh-host-or-alias> --project-root <remote-posix-absolute-root> --staging-root <local-absolute-root>
node scripts/init-mcpshell-workspace.mjs preview --identity <server-identity>
```

成功 preview 对 env 和受管 registration 分别给出不含敏感值的 `create`、`update` 或 `unchanged` action，且永不写入。部分提供 flag、缺失或无效 env，或 definitions/ignore rule 前置条件失败时，在任何写入前停止。只有当前任务明确授权修改 agent 项目时，才将同一命令的 `preview` 改为 `apply`；apply 只写 action 中实际改变的 resource。initializer 仅维护带自身拥有标记的 `[mcp_servers.<identity>]` table；同名非受管 table 不覆盖。移除由用户明确请求触发，`--remove-env` 才删除本机 env。

初始化使用已有的 MCPShell 和系统 `ssh`；不安装 MCPShell、不修改 SSH 凭据、用户目录或目标项目。扩大到这些对象需要精确授权。

### 3. 在运行时验证并继续

1. 从运行时确认四项 callable tools。
2. 用 `workspace_shell` 检查当前目录和 `git rev-parse --show-toplevel` 都是目标 project root，并运行一个只读非零命令确认目标失败证据可见。
3. 真实 patch 或文件传输只随原任务发生，不为初始化制造目标项目改动。
4. 如需会话 reload，交接原任务、server identity、project root、staging root 与预期 tool names；重载后重复本步骤。

## 读取结果与恢复

所有 operation result 都标识 operation、`ok`、`failure_kind`、target 和相应证据。MCP 调用返回不等于目标操作成功。

| 结果 | 含义与下一步 |
| --- | --- |
| shell 的目标退出、`timeout` 或 `transport_failure` | 根据 stdout、stderr、target 与 failure evidence 判断；不要把 MCP 返回本身当作命令成功。 |
| patch 成功 | 用 shell 核验内容和 Git diff；patch 只有所有目标成功才完成。 |
| file 成功 | 仅在 `failure_kind` 为 `null`、byte count 与两端 SHA-256 一致时完成。 |
| `output_limit` | 返回 MCP 的 stdout 或 stderr 超过 1 MiB；输出只是不超过上限的前缀，不能判断目标成功。evidence 给出 stream 和 limit，`target.exit_code` 为 `null`。缩小命令、定向读取或改用符合原任务的操作后再继续。get 的原始文件字节不计入文本上限，但 stderr 仍受限。 |
| put 的 `outcome_unknown` | final destination **可能已提交**，包括可能提交阶段发生输出超限。evidence 包含 destination、预期 bytes、SHA-256；超限还包含 `cause: "output_limit"`、stream 和 limit。先用 `workspace_shell` 核验路径和 SHA-256，再决定是否重试；不得直接以 `replace=true` 覆盖重传。 |

runtime deadline 为 shell/patch 110 秒、put/get 290 秒；对应 YAML outer timeout 为 2m、5m，为终止处理和 envelope 返回留出余量。它们约束 helper 的运行时间，不承诺目标操作已经完成。

## 运行前提

| 对象 | AI 使用前必须满足的条件 |
| --- | --- |
| Agent host | POSIX host，存在 `/bin/sh`、`node`、已有 `mcpshell` executable 和系统 `ssh`。 |
| Backend | agent host 的 `ssh -T` 可访问 backend，且 backend 有 POSIX `sh`、`git apply`、`mktemp`、`wc` 和 SHA-256 工具。 |

当前支持 POSIX host；缺少表中 executable、backend 依赖或依赖 shell alias 的环境不适用。skill 使用已有 MCPShell 和 SSH 连接，不安装、降级或管理 MCPShell、SSH config、credential、账号、daemon 或生产连接；这些对象需要由当前环境和用户授权另行处理。

## 操作边界

1. shell、patch 与 file paths 受固定 roots 约束；staging 只保存当前任务明确需要的交换文件。绝对路径、`..`、`.git` 内部路径、静态或操作时观测到的越界 symlink 和非普通文件 source 会被拒绝。
2. roots 防止误操作，不是对同一 OS/SSH identity 恶意并发 rename 的安全 sandbox；该 identity 本就可借 shell 操作 root 所见文件。
3. command/patch 超过 64 KiB 会在连接前拒绝。提交前的失败不留下 helper temporary。
4. get 的 source 必须由原任务正当化；凭据、secret 和无关项目内容需要单独依据。

## 完成标准

1. AI 能区分 agent 项目、目标 project root 与 agent staging root，并从正确位置恢复注册和本机配置。
2. 四项 tools 的实际名称和固定 roots 已恢复；shell 的 root 与失败结果已验证。
3. 后续查看、修改与传输按“选择 tool”执行，目标项目只收到原任务要求的内容。
4. 原任务所需的可观察结果已按所用 tool 的完成证据核验：shell 看 stdout、stderr、退出状态和 root，patch 看内容与 Git diff，file 看两端路径、byte count 和 SHA-256。
