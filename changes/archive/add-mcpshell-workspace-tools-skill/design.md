# Design

本 Change 以 AI 的实际消费路径组织核心 skill：AI 先取得固定工作区的便捷 tools，再按操作选择合适入口并继续原任务。

## Context

- 个人 agent 配置与协作项目需要保持不同 owner，项目的物理位置由 backend 封装。
- 前期调查确认 MCPShell 可以声明自定义 tools，并验证了本地固定目录中的 command 与 Git diff；真实 SSH、apply-patch 和双向文件 transport 尚未验证。
- 核心 skill 的消费者是 AI。正文需要先回答 AI 获得哪些 tools、何时选哪一个、怎样确认结果，再说明初始化和配置边界。
- 确定性 provider 属于辅助工具交付；当前 Change 固定消费契约和交接，不实现 transport。

## Goals / Non-Goals

目标：

- 让 AI 在当前工具不能作用于目标项目时取得四项固定 workspace tools。
- 让 AI 优先用 shell 查看文件和执行命令，优先用 patch 修改文档与其他文本，并在移动文件实体时使用 put/get。
- 让其他已验证 workspace tools 能按任务继续使用。
- 让初始化、会话重载和 provider 缺失路径保留原任务与已恢复 roots。
- 让 agent config、agent staging 和 project root 的内容边界可验证。

非目标：

- 本 Change 不实现 MCPShell provider、SSH transport、patch engine 或文件传输 helper。
- 不创建 SSH 凭据、远端账号、工作区或网络服务。
- 不建设目录镜像、自动同步、交互式 PTY 或通用 remote platform。

## Decisions

### Intended Change

#### AI consumption contract

- **消费者：** 当前工具连接到个人 agent 环境、但需要完成另一个项目工作区任务的 AI。
- **实际入口：** AI 先获得 name/description，触发后读取 `SKILL.md`；provider 以后作为 skill 明确携带或链接的资源进入执行路径。
- **预期操作：** 保存原任务，取得固定 roots 的四项 tools，验证 tool 语义，按操作选择便捷入口并继续原任务。
- **可观察结果：** 命令、patch 和文件传输落在预期 roots；AI 能选择首选 tool，也能采用其他已验证 workspace tool。

```text
保存原任务
  -> 检查现有 workspace tools
  -> 必要时调用 provider
  -> 取得并验证四项 tools
  -> 读取项目规则
  -> 按操作选择工具并继续原任务
```

#### Tool responsibilities

| 操作 | 首选 tool | 关键结果 |
| --- | --- | --- |
| 文件查看、命令、构建、测试、Git 审查 | `workspace_shell` | 目标输出、退出状态与失败类型 |
| 文档和其他文本修改 | `workspace_apply_patch` | 整体应用结果与受影响路径 |
| agent staging 到项目的文件传输 | `workspace_put_file` | 两端路径、byte count 与 SHA-256 |
| 项目到 agent staging 的文件传输 | `workspace_get_file` | 两端路径、byte count 与 SHA-256 |

四项 callable names 可被 MCP namespace 改写，因此初始化结果记录实际名称。backend handle、project root 与 agent staging root 固定在 bridge 中，不进入日常 tool schema。

shell 和 patch 承接普通开发路径；put/get 只在任务需要移动文件实体时进入。其他工具只要已经证明指向同一 project root，也可以用于更适合的操作。

#### Provider and recovery

provider 接收 bridge identity、backend handle、project root、agent config root 和 agent staging root，预览用户级写入和 MCP 注册后建立 tools。涉及安装、用户配置、MCP 注册、SSH 配置或访问范围的变化时，由用户授权精确对象。

provider 缺失时，交付保留原任务和已恢复输入。运行时需要重载时，交付同时保留 bridge identity、roots 和预期 callable names，下一会话从 tool 验证继续。

### Resulting Impacts

- **Skill 正文：** 工具选择和原任务连续性位于主线，provider 生命周期作为取得 tools 的支持流程。
- **Tool 语义：** shell、patch、put 和 get 分别拥有单一清楚的首选用途与验证结果。
- **执行边界：** project operations 采用已验证的 workspace-aware tools；内建本地文件工具负责 agent staging 中的任务文件。
- **配置边界：** 个人配置和 bridge 实例留在 agent config root，项目只保存项目内容。
- **辅助实现：** helper Draft 负责 command/patch/file transport、固定 roots、失败状态和容量边界。

## Risks / Trade-offs

| 风险或取舍 | 当前处理 |
| --- | --- |
| provider 尚未交付 | skill 明确输出依赖缺口和恢复交接，不宣称真实 tools 已可用 |
| 便捷默认被理解为排他路由 | 工具表使用“首选”，并保留其他已验证 workspace tools 的选择条件 |
| 文件查看误用 get | tool 表和执行流程把查看归给 shell，把 get 限定为文件实体传输 |
| patch 或文件 transport 失真 | helper 需要证明 patch 整体应用、byte count、SHA-256、原子落盘和失败清理 |
| staging 混入个人配置或成为项目镜像 | staging root 与 config root 分离，只保存当前任务明确使用的交换文件 |

## Open Questions

辅助工具仍需通过真实 PoC 确定 command/patch 参数通道、结果 envelope、staging root 落点、MCPShell 安装方式、容量限制、远端 shell 支持范围，以及 patch 整体失败行为。这些问题决定 provider 实现，不改变当前工具选择契约。

## Implementation Observations

- 当前 `SKILL.md` 已按“目标—工具选择—tool 契约—建立或恢复—继续任务—边界—完成标准”组织。
- 代表性语义路径包括：文件查看和命令使用 shell；文档与文本修改使用 patch；文件实体按方向使用 put/get；已有合适 workspace tool 时直接采用；provider 缺失或会话重载时恢复原任务。
- 工具选择与 tool 契约先于 provider 流程；保留的负向条件只用于命令成功判断、provider 事实缺口、path rejection、部分写入防护和敏感文件依据。
- 当前 skill owners 只表达现行工具集合、默认用途和证据边界。
- 真实 provider、SSH、patch 和双向文件调用尚未执行。
- 单 skill、updater、Change Plan 单项（12/12 tasks）与 11 个 active Changes 集合检查及 `git diff --check` 均通过；全仓 `bun run check` 的 32 个基础 checks 通过、0 失败，28 个 release-tag-only checks 未运行。
