# Proposal

本 Draft Change 为新增一个初始化型 MCPShell 工作区 bridge skill 做准备，目标是让个性化 agent 能用预实现快速接通隔离项目工作区。

## Why

辅助工具只能提供确定性的 SSH transport 和 shell/diff operation，不能自行判断 agent 域与项目域、确认外部前置条件、取得用户级配置授权或完成可回退交付。如果没有 skill，使用者仍需理解 MCPShell YAML、Codex MCP 注册和验证顺序，并可能把个人配置重新写入协作项目。

用户希望该 skill 不只是工具说明，而是携带或调用已经实现的辅助能力；同时它只应在初始化、修复或删除 bridge 时出现，日常开发直接使用生成后的 MCP tools。

## Outcome

仓库提供一个可分发的初始化型 skill：它识别 agent 与隔离工作区边界，检查 SSH 和 MCPShell 前置条件，在获得明确授权后使用预实现建立并验证用户级 `shell`/`diff` bridge，并交付停用或删除路径；个人 bootstrap 配置不进入项目工作区。
