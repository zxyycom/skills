# MCPShell Workspace Tools

`mcpshell-workspace-tools` 让保存个人规则和 skills 的 agent 项目，经 MCPShell 操作另一个隔离的固定 project root。backend 可以连接同机、容器或远端目标；AI 仍按同一规则工作：查看、命令、构建、测试和 Git 审查使用 `workspace_shell`，文本修改使用 `workspace_apply_patch`，只有文件实体跨边界时才使用 `workspace_put_file` 或 `workspace_get_file`。这些是便捷入口，不排斥已验证指向同一 root 的其他工具。

配置属于 agent 项目：项目级 `.codex/config.toml` 注册 MCP，skill 同目录的 `.env.mcpshell` 保存本机 backend handle、目标 project root 和 staging root；`.gitignore` 排除真实 env，`.env.mcpshell.example` 提供可跟踪的字段说明。initializer 默认只预览；显式 apply 才维护带拥有标记的 MCP table 和本机 env，并在同名非拥有 table 上停止。

skill 随包分发可由 Node 直接运行的 initializer、runtime helper 与 MCPShell definitions。runtime 以固定 roots 运行完整 command/patch，并对单个文件传输校验 byte count 和 SHA-256。put 返回 `outcome_unknown` 时，目标文件可能已经写入；必须先用 `workspace_shell` 核验 destination 与 SHA-256，不能直接覆盖重传。

运行需要已有的 MCPShell、系统 `ssh`，以及提供 POSIX `sh`、`git apply`、`mktemp`、`wc` 和 SHA-256 工具的 backend。仓库以隔离 SSH fixture 验证 argv、stdin、失败与字节协议；真实 sshd、已安装 MCPShell binary 与 Codex reload 仍由使用环境验证。

实际行为入口位于 [`skills/mcpshell-workspace-tools/`](../../skills/mcpshell-workspace-tools/)。
