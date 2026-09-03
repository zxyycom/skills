# Proposal

本 Change 交付一个由 AI 实际消费的 MCPShell workspace tools skill：AI 在现有工具无法直接操作目标项目时取得固定项目的 shell、apply-patch 与双向单文件便捷 tools，并继续原任务。

## Why

个人 agent 环境可以保留用户自己的 skill、规则和 MCP 配置，协作项目只保留项目共同认可的内容。当两者处于不同执行边界时，AI 需要稳定的 workspace tools 才能查看文件、执行命令、修改文本和移动文件实体，而不必在每项任务中重新处理 backend、路径和 transport。

工具集合需要表达清楚的默认分工：文件查看和命令执行优先使用 shell，文档及其他文本修改优先使用 patch，put/get 只承接文件实体传输。这个分工帮助 AI 快速选择便捷入口，同时保留其他已验证 workspace tools 的使用空间。

## Outcome

仓库提供 `mcpshell-workspace-tools` skill。AI 能保存原任务、恢复固定 backend/roots，并在已有等价 tools 时直接使用；provider 可用后，AI 通过它取得和验证四项 tools，provider 缺失时则保留恢复交接而不误报真实 transport 已交付。个人配置保留在 agent config root，文件交换发生在独立 staging root，项目内容落在固定 project root。

## Scope

### Intended Change

- 创建 `skills/mcpshell-workspace-tools/`，以 AI 取得并使用 workspace convenience tools 为主线。
- 定义 `workspace_shell`、`workspace_apply_patch`、`workspace_put_file` 和 `workspace_get_file` 的选择条件、输入、结果与完成证据。
- 定义现有 tools 复用、provider 初始化、会话重载和原任务恢复路径。
- 定义 agent config、agent staging 与 project root 的责任边界。
- 同步 UI metadata、`AGENTS.md`、`README.md`、人类介绍和标准 updater。
- 向辅助工具 Draft 交接 command、patch 和双向单文件 transport 的实现义务。

### Resulting Impacts

- AI 通过稳定工具名操作固定项目根，backend 的物理位置不进入日常选择。
- shell、patch 和 file transfer 各自拥有清楚的首选用途；其他已验证 workspace tools 保持可用。
- provider 需要交付固定 roots、结果状态、路径边界、patch 整体应用以及文件字节校验。
- 初始化写入保留在 agent config root，project root 只承接项目内容。

## Success Criteria

1. description 能让 AI 在当前工具与目标项目处于不同执行边界时触发，并在已有正确 workspace tools 时直接继续。
2. 正文以工具选择和继续原任务为重心，provider 生命周期只承接取得 tools 所需的步骤。
3. AI 能恢复以下默认：查看文件和执行命令用 shell，修改文档和其他文本用 patch，移动文件实体用 put/get。
4. tool 契约说明输入、固定 roots、结果状态和与操作相称的验证方式。
5. provider 缺失或需要会话重载时，恢复交接保留原任务、bridge identity、roots 和预期 tool names。
6. UI、项目入口、人类介绍、helper 交接和 updater 与 `SKILL.md` 一致。

## Affected Owners

- `skills/mcpshell-workspace-tools/`：AI 触发、工具选择、初始化、恢复和完成标准。
- `AGENTS.md`：仓库内 skill 概览。
- `README.md` 与 `docs/skills/mcpshell-workspace-tools.md`：面向人类的定位和当前能力边界。
- `changes/archive/add-mcpshell-workspace-tools-skill/`：本 Change 的归档计划和验证证据。
- `changes/build-mcpshell-workspace-bridge-helper/`：command、patch 和双向 file transport 的后续实现 owner。
