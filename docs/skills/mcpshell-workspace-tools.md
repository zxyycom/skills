# MCPShell Workspace Tools

`mcpshell-workspace-tools` 让保存个人规则和 skills 的 agent 项目，经 MCPShell 操作另一个隔离的固定 project root。查看、命令、构建、测试和 Git 审查使用 `workspace_shell`；文本修改使用 `workspace_apply_patch`；只有文件实体跨边界时才使用 `workspace_put_file` 或 `workspace_get_file`。这些是便捷入口，不排斥已验证指向同一 root 的其他工具。

## 配置与运行边界

安装后的 bridge 使用本机配置连接隔离的目标 root；配置包含敏感本机信息，不应提交。初始化先预览，只有显式 apply 才写入；切换已有 bridge identity 需要明确授权。配置变更后重新核验目标 root。具体字段、初始化与移除流程以 [Skill](../../skills/mcpshell-workspace-tools/SKILL.md) 及其引用为准。

命令及传输有时间和输出边界。输出受限不证明目标成功；上传在提交结果未知时，必须先核验目标内容，不能直接覆盖重传。准确结果、预算与恢复步骤由 skill 的工具契约承接。

## 支持与验证

支持 POSIX agent host 和通过 SSH 可访问的 backend；具体可执行程序前置见 [运行前提](../../skills/mcpshell-workspace-tools/SKILL.md#运行前提)。skill 不安装或降级 MCPShell，也不管理 SSH 配置、凭据、账号、daemon 或生产连接。

仓库 fixture 验证 bridge 协议；真实集成须显式运行 `validate --tools`、stdio initialize、tools/list 和一次只读 shell call。已有 MCPShell v0.2.0 binary 已通过此最小 smoke；其他 binary 仍需独立验证。

机械 MCP 事实优先由 smoke 和 `codex mcp` 证明。只有 smoke 已通过、Codex auth 可用、非交互 approval policy 允许 MCP `tools/call`，且维护者明确选择时，才可在隔离 roots 中执行一次 Luna 自然任务。approval policy 阻止调用时，只能记录工具选择，不能证明任务完成，也不以第二次调用补测。

实际行为入口位于 [`skills/mcpshell-workspace-tools/`](../../skills/mcpshell-workspace-tools/)。
