# Proposal

本 Change 为 `mcpshell-workspace-tools` 交付可分发的 workspace bridge：Node `.mjs` initializer、受管的 agent 项目 MCP registration、四项 tool definitions 和绑定固定目标 root 的 SSH helper。AI 取得 tools 后按 shell、apply-patch、put 或 get 的职责完成原任务，无需在每次调用中重复提供 backend 或 root。

## Why

核心 skill 已定义 agent 项目与目标工作区的分离、项目级 MCP registration、同目录本机 env 和四项 tools 的选择规则。bridge 将这些固定约束落实为可安装、可验证的运行时，避免每次初始化手工处理配置、传输与文件落盘。

隔离 SSH fixture 已证明完整 command 经 stdin 只由目标 shell 解释、失败的多文件 `git apply` 不留下先前 hunk、文件字节往返的 byte count 与 SHA-256 一致。该证据验证 helper 的协议，不替代真实 sshd 的环境验证。

## Outcome

skill 随包提供可由 Node 直接运行的 initializer、runtime helper 和 MCPShell definitions。initializer 默认预览，显式写入时幂等维护带拥有标记的 agent 项目 MCP table 与本机 env，并能精确移除；runtime 在固定 POSIX project root 执行完整 command、整体应用 patch，并在 project root 与 agent staging root 间传输单个常规文件。每项 operation 都返回包含成功状态、失败类别、目标状态和 operation 证据的可判断 envelope。

## Scope

### Intended Change

- 在 `tools/mcpshell-workspace-bridge/` 维护 Node initializer、runtime helper、MCPShell definitions、隔离 SSH fixture 与最小原生测试。
- 将可直接由 Node 执行的 `.mjs`、source map 和 MCPShell YAML 生成到 `skills/mcpshell-workspace-tools/`。
- 以 agent 项目 `.codex/config.toml`、skill 同目录 `.env.mcpshell` 和 bridge identity 提供预览、受管写入、冲突停止与精确移除。
- 实现 `workspace_shell(command)`、`workspace_apply_patch(patch)`、`workspace_put_file(source_path, destination_path, replace=false)` 与 `workspace_get_file(source_path, destination_path, replace=false)`；backend 和 roots 在启动时绑定。

### Resulting Impacts

- 根构建适配、稳定 package scripts 和 `docs/tooling.md` 维护源码、skill 产物与 Node 分发边界的一致性。
- 核心 skill、README 与人类介绍说明实际 initializer、definitions、工具选择和环境验证边界。
- 测试证据账本为保留的 Bun 原生测试入口维护可检索 case 与索引。
- `bind-mcpshell-workspace-from-project-env` 保持配置 owner 与已交付 runtime 的事实一致。
- 真实 MCP registration、SSH 连接和目标工作区写入仍由使用任务取得精确授权；本 Change 不连接生产主机。

## Success Criteria

1. 安装 skill 后可只用 Node 执行 initializer 与 runtime；分发运行时除 Node 内置模块外只调用系统 `ssh`，backend 提供明确的 POSIX 工具集。
2. 跟踪的 MCP table 只含项目相对 resource 路径；backend handle 和绝对 roots 只进入被精确 ignore 的同目录 `.env.mcpshell`，并有 example 和测试。
3. 四项 tools 的参数、固定 roots、结果 envelope、容量、路径拒绝、目标失败、timeout、transport failure 与 `outcome_unknown` 均可由调用方判断。roots 防误操作，不是同一 identity 恶意并发 rename 的安全隔离。
4. command 与 patch 经 SSH stdin 由目标单一消费；失败 patch 不留下部分 hunk。put/get 以原始 byte count 与两端 SHA-256 验证，接收端原子落盘。
5. put 在 final commit 后确认丢失时返回携带 destination、预期 bytes 和 SHA-256 的 `outcome_unknown`；调用方先核验，不能把它当成未写入。
6. 初始化重复运行不复制配置；同名非受管 MCP table 停止且不改写；移除只删除拥有标记的 identity，并仅在明确请求时删除 env。

## Affected Owners

- `tools/mcpshell-workspace-bridge/`：provider、runtime、协议、fixture 与测试的维护源码。
- 根 `scripts/build/`、`package.json` 与 `docs/tooling.md`：构建、稳定命令及源码/分发映射。
- `skills/mcpshell-workspace-tools/`：AI 行为入口和实际分发资源。
- `README.md` 与 `docs/skills/mcpshell-workspace-tools.md`：面向人类的当前交付边界。
- `docs/test-evidence/`：新增最小原生测试入口的可检索证据。
- `changes/bind-mcpshell-workspace-from-project-env/`：agent 项目配置契约的同步说明。
