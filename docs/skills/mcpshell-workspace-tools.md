# MCPShell Workspace Tools

`mcpshell-workspace-tools` 让保存个人规则和 skills 的 agent 项目，经 MCPShell 操作另一个隔离的固定 project root。查看、命令、构建、测试和 Git 审查使用 `workspace_shell`；文本修改使用 `workspace_apply_patch`；只有文件实体跨边界时才使用 `workspace_put_file` 或 `workspace_get_file`。这些是便捷入口，不排斥已验证指向同一 root 的其他工具。

## 配置与初始化

agent 项目的 `.codex/config.toml` 注册 MCP；skill 同目录的 `.env.mcpshell` 保存本机 backend handle、目标 project root 和 staging root；`.gitignore` 排除真实 env，`.env.mcpshell.example` 提供可跟踪的字段说明。runtime 每次调用读取 env，修改从下一次调用生效，之后必须重新核验目标 root。

initializer 先以 preview 输出 env 和受管 registration 的无敏感值 `create`、`update` 或 `unchanged` action；显式 apply 才写入实际改变。三项 config flag 要么全部提供，要么全部省略并复用已有有效 env 来恢复 registration；其余输入或前置条件失败均在写入前停止。一个安装的单例 env 只允许一个 active bridge-owned identity：存在另一 identity 时 preview/apply 返回 `config_conflict`，维护者须在明确授权下精确 remove 旧 identity 后再切换。

## 结果与运行边界

shell/patch 的 helper deadline 是 110 秒，put/get 是 290 秒；相应 YAML outer timeout 是 2m、5m。返回 MCP 的 stdout、stderr 各最多 1 MiB：`output_limit` 表示只取得有界前缀，必须用 stream/limit evidence 继续判断，不能认定目标成功。get 的原始文件字节不计入此文本预算。

put 在可能提交阶段发生输出超限时返回 `outcome_unknown`，其 evidence 包含 destination、预期 bytes、SHA-256、`cause: "output_limit"`、stream 和 limit。目标可能已经写入：必须先用 `workspace_shell` 核验 destination 与 SHA-256，不能直接覆盖重传。已知未提交的超限仍是 `output_limit`。

## 支持与验证

支持 profile 是具备 `/bin/sh`、Node、已安装 `mcpshell` 和系统 `ssh` 的 POSIX agent host；backend 必须可由 `ssh -T` 访问，并提供 POSIX `sh`、`git apply`、`mktemp`、`wc` 与 SHA-256 工具。skill 不安装或降级 MCPShell，也不管理 SSH config、credential、账号、daemon 或生产连接。

仓库 fixture 验证 bridge 协议；真实集成须显式运行 `validate --tools`、stdio initialize、tools/list 和一次只读 shell call。已有 MCPShell v0.2.0 binary 已通过此最小 smoke；其他 binary 仍需独立验证。

机械 MCP 事实优先由 smoke 和 `codex mcp` 证明。只有 smoke 已通过、Codex auth 可用、非交互 approval policy 允许 MCP `tools/call`，且维护者明确选择时，才可在隔离 roots 中执行一次 Luna 自然任务。approval policy 阻止调用时，只能记录工具选择，不能证明任务完成，也不以第二次调用补测。

实际行为入口位于 [`skills/mcpshell-workspace-tools/`](../../skills/mcpshell-workspace-tools/)。
