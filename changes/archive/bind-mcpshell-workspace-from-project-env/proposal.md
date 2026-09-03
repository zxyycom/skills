# Proposal

本 Change 明确 `mcpshell-workspace-tools` 的配置与运行边界：skill 属于 agent 项目，目标工作区由 MCP backend 封装；AI 取得 tools 后按 shell、patch、put 或 get 的职责工作，而不在每次调用中重新定位工作区。

## Why

agent 项目与协作目标工作区承担不同内容：前者保存个人 rules、skills 和项目级 MCP 注册，后者只承接项目任务。机器绝对路径和 backend handle 也需要与可跟踪的项目配置分离，避免 AI 把配置写入错误位置或把连接信息提交到仓库。

## Outcome

核心 skill 能让 AI 恢复三类位置的责任、四项 tools 的首选用途和项目内初始化路径。`.codex/config.toml` 仅保存可跟踪的 MCP 注册；同目录、被 `.gitignore` 精确排除的 `.env.mcpshell` 保存本机 backend handle、project root 与 staging root。关联 bridge 以 Node `.mjs`、完整 command/patch 字符串和 SSH 数据通道落实这一配置契约；真实环境连接仍在使用时验证。

## Scope

### Intended Change

- 将核心 skill 的配置 owner 定义为安装该 skill 的 agent 项目。
- 规定项目级 `.codex/config.toml` 只注册 MCP，机器相关值由 skill 同目录 `.env.mcpshell` 提供。
- 提供可跟踪的 `.env.mcpshell.example` 与同目录 `.gitignore`，并以 skill version `4` 交付当前配置和 bridge 契约。
- 保持 shell、patch、put、get 的工具选择：查看和命令用 shell，文本修改用 patch，文件实体传输才用 put/get。
- 同步 README、人类介绍和 helper Change，使文档以当前已交付 runtime 与环境验证边界为准。

### Resulting Impacts

- server 启动时把 `.env.mcpshell` 中的 backend、project root 和 staging root 绑定到实例；日常 tool 参数不重复接收 workspace 路径。
- command 与 patch 保持完整字符串并经 SSH stdin 作为数据传输；put/get 使用字节流。
- `build-mcpshell-workspace-bridge-helper` 拥有 runtime、测试和分发实现；本 Change 拥有 agent 项目配置与 AI 阅读路径。

## Success Criteria

1. AI 能区分 agent 项目、目标工作区和 agent staging，并知道各类文件的 owner。
2. `.codex/config.toml` 不含机器绝对路径；`.env.mcpshell` 的位置、字段、忽略规则和 example 一致。
3. AI 能恢复四项 tools 的职责与固定 roots，不把本机配置放入日常 tool 参数。
4. skill、README、人类介绍和 helper Change 一致说明 Node 分发、完整字符串/字节数据路径、`outcome_unknown` 恢复方式与真实环境验证边界。
5. 单 skill、两项 Change 与相关 Markdown/diff 检查通过。

## Affected Owners

- `skills/mcpshell-workspace-tools/`：AI 行为入口、项目内配置资源和分发版本。
- `docs/skills/mcpshell-workspace-tools.md` 与 `README.md`：面向人类的定位和当前交付边界。
- `changes/build-mcpshell-workspace-bridge-helper/`：Node helper、MCPShell definitions、transport 和初始化实现。
- `changes/bind-mcpshell-workspace-from-project-env/`：agent 项目配置契约、文档与验证记录。
