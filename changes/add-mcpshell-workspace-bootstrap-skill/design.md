# Design

本 Draft 将 skill 定位为桥接初始化的协调 owner，并把传输与命令实现交给独立辅助工具 Change；具体名称、分发文件和调用接口要等真实 SSH PoC 后收敛。

## Context

- [`MCPShell 工作区桥接前期调查`](../../docs/investigations/evaluate-mcpshell-as-user-scoped-workspace-bridge.md)确认当前只足以继续真实 SSH PoC，尚未确认最终 skill 名称、目录、CLI、输出 schema 或安装边界。
- [`build-mcpshell-workspace-bridge-helper`](../build-mcpshell-workspace-bridge-helper/)负责 shell/diff 的单次 SSH transport、参数边界、错误结果和测试。本 Change 不复制其实现或提前固定尚未闭合的接口。
- 用户级 skill 和 MCP 配置可以留在个性化 agent 环境；协作项目只保留团队共同认可的文件。用户级位置不消除 shell 写权限，skill 仍需明确授权和验证。
- 本仓库每个新 skill 必须包含 `SKILL.md` 与正整数字符串 `metadata.version`，并进入聚合打包、自更新和项目概览；随 skill 分发的确定性脚本或素材需要清楚的源码与生成 owner。

## Goals / Non-Goals

目标：

- 让 agent 在初始化、修复或删除工作区 bridge 时能够准确触发并完成一条可回退流程。
- 把辅助工具作为预实现交付，而不是要求使用者手写 MCPShell YAML、SSH quoting、Git diff 或 Codex TOML。
- 只收集建立 bridge 所需的最小输入，并把 SSH host 与项目根固定在用户域配置中。
- 在写用户目录、注册 MCP server 或触及外部环境前取得与操作范围相称的明确授权。
- 初始化完成后让日常 agent 直接使用 MCP tools，不要求 bootstrap skill 持续进入上下文。

非目标：

- 不拥有 SSH 凭据、远端账号、项目权限、工作区创建或网络服务运维。
- 不把个人 skill、规则或 MCP 配置写入目标项目。
- 不在本 Change 中重新实现 SSH transport、diff operation 或 MCPShell 错误包装。
- 不承诺 HTTP、PTY、GUI、二进制传输、文件同步或任意 backend registry。
- 不把待创建的 MCP tools 声明为 bootstrap skill 自身的硬依赖，避免循环启动条件。

## Decisions

### Intended Change

当前确认把核心 skill 与辅助工具拆成两个 Change；本 Change 依赖辅助工具 Change 在进入 Plan 前给出经过真实 SSH PoC 的最小调用契约。

skill 的候选主流程为：识别 agent/workspace 边界，读取最小连接输入，只读预检，展示用户级候选配置，取得写入授权，调用预实现建立 bridge，运行 smoke test，并交付删除方式。`SKILL.md` 只拥有判断、权限、步骤和完成标准；确定性渲染、注册和 transport 进入随包脚本或辅助工具产物。

本 Draft 暂以 `mcpshell-workspace-bootstrap` 作为工作名称，不把它视为最终身份。进入 Plan 前需根据真实触发语句、分发边界和辅助工具接口确认名称、description、读取策略、产物以及是否需要 `references/`、`scripts/` 或 `assets/`。

### Resulting Impacts

- **Skill 本体：** 新增一个独立版本的 `skills/<skill-name>/SKILL.md`，说明显式触发、输入、授权、调用、失败与完成状态。
- **预实现分发：** 接入辅助工具 Change 的可分发产物，并明确哪些文件是源码、构建产物、配置模板和用户运行时实例；不能让使用者根据文档重新实现。
- **仓库集成：** 新 skill 需要同步 `AGENTS.md` 概览、按需新增 `docs/skills/` 人类介绍，并确认聚合打包和 updater 覆盖。
- **版本与长期判断：** skill 行为、触发、资源 owner 或验收成为稳定契约时，按 Decision Records 门槛判断是否记录；Draft 阶段不提前创建决策。
- **测试与验证：** 需要验证 skill 结构、触发恢复、只读预检、授权门禁、辅助工具缺失路径、成功初始化、失败诊断和删除交付；新增测试入口同步 Test Evidence ledger。

## Risks / Trade-offs

| 风险或取舍 | Draft 中的处理 |
| --- | --- |
| Skill 在 helper 契约前定型会产生重复改写 | 两个 Change 同时保持 Draft，先闭合 helper 的 SSH PoC 和最小接口 |
| 自动写用户级配置可能覆盖并行设置 | 优先使用 Codex 公共 MCP 注册入口；写入前展示目标和冲突，具体事务待设计 |
| 只初始化一次会降低自然触发概率 | description 明确覆盖建立、修复和移除 bridge；日常使用不触发是预期行为 |
| Skill 携带预实现可能扩大包体和更新责任 | 只分发 shell/diff 所需最小脚本与模板，MCPShell 二进制安装是否纳入仍保持开放 |
| 用户把位置透明误解成权限透明 | 明确用户级配置与远端项目权限是不同边界，每项外部写入单独授权 |

## Open Questions

1. 最终 skill 名称应强调 MCPShell、workspace bridge 还是初始化行为？
2. 辅助工具完成后，skill 应直接调用一个 bootstrap CLI，还是分别调用配置渲染、注册和检查入口？
3. MCPShell 二进制是显式前置条件，还是由 skill 提供固定 release 的可选安装路径？
4. 用户级 bridge 实例保存在哪个 owner 路径，怎样避免与现有 MCP server 名称冲突并精确删除？
5. 真实 SSH PoC 通过后，第一版是否只支持 SSH，还是允许不增加额外复杂度的同机后端？
6. 如何验证“个人配置未进入项目”而不在 smoke test 中制造或清理真实项目改动？

## Draft Handoff

后续恢复本 Change 时按以下顺序处理：

1. 先读取辅助工具 Change；它尚未交付经过真实 SSH PoC 的调用面、参数边界和失败语义时，本 Change 保持 Draft，不派生 tasks。
2. 接收 helper 交付后，回答 Open Questions 1—4，并确认 skill 只拥有触发、授权、初始化流程、分发组合和完成状态。
3. 用一个“建立 bridge”和一个“辅助工具缺失或连接失败”的代表性请求检查 description、读取路径与失败交付是否能被 AI 正确恢复。
4. 完成 owner、成功标准和验证义务后再生成 `tasks.md` 并请求进入 Plan；Draft 本身不授权写用户级配置或实现 skill。
