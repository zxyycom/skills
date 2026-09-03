---
title: "MCPShell 工作区桥接前期调查：通过 SSH 暴露 shell 与 diff"
formedAt: "2026-09-03T06:47:09+00:00"
question: "是否值得继续验证一个初始化型 skill，使带个人配置的 agent 能通过 MCPShell 操作隔离工作区，并获得预实现的 shell 与 diff？"
tags:
  - "agent-workspace-isolation"
  - "mcpshell"
  - "preliminary-research"
  - "workspace-bridge"
relations: []
---

## 形成时背景

本仓库维护的多项 Codex skills 带有明显的个人工作偏好。一个 agent 的运行与配置环境中还可能存在个人规则、MCP server 和其他设置；若这些内容随协作项目进入工作区，会让其他贡献者被动承担并未共同确认的流程和风格。

用户希望把个性化 agent 环境与项目工作区分开。问题不只是把 skill 文件移到用户目录：当项目工作区位于另一个执行边界时，agent 的内建 shell 和文件工具未必能直接作用于它。若每次任务都临时拼接 SSH、路径、文件传输和 Git 命令，读取、修改、测试与审查会产生重复操作。

用户此前使用过 [`inercia/MCPShell`](https://github.com/inercia/MCPShell) 控制其他环境，因此提出一个候选方向：通过一次初始化，让 MCPShell 向 agent 暴露固定工作区的 `shell` 与 `diff`。工作区位于同机 SSH 环境、局域网主机还是真正远端并不影响 agent 侧工具名称；位置差异由 SSH 连接掩盖。

用户同时明确：候选 skill 不应只讲解如何手工搭建，还应提供一份可直接使用和调整的预实现。但本轮仍是**前期调查**，不是 skill 提案、设计确认、实施任务或外部配置授权。

## 调查目的

本轮调查用于支持以后是否正式启动该 skill，而不是直接定义其最终契约。具体回答：

1. agent 环境与项目工作区隔离的问题是否真实存在；
2. MCPShell 的自定义工具能力能否承接一个小型工作区桥接；
3. `shell`、`diff` 和 SSH 传输的最小候选形态是什么；
4. 哪些部分已有证据，哪些仍只是待验证假设；
5. 正式设计或实现前还必须取得哪些证据和用户决定。

### 报告消费边界

本报告的读者是以后复查该方向的人类或 AI。读者应能从本文恢复问题、证据、候选方案和未知项，并据此设计下一轮 PoC 或判断是否立项。

本报告不能单独授权或证明以下事项：

- 创建 `skills/<name>/`、`tools/<name>/` 或其他实现目录；
- 把候选文件名、CLI 名称、字段或输出格式当作已确认契约；
- 安装 MCPShell，修改 `~/.codex/config.toml`、SSH 配置或远端工作区；
- 启动长期服务、开放端口或把候选工具用于真实项目写入；
- 宣称真实 SSH 传输、多人协作隔离或完整开发流程已经验证。

本轮实际动作仅限调查报告、一次性本地 PoC 和一次性 Codex MCP 注册测试。

## 调查范围与依据

仓库侧以 `main@ad7bc9eeaf081cdf69b06313ebc64a26578bc357`、2026-09-03T06:47:09+00:00 的干净工作树为调查基线，检查了仓库模型、导航、skill 维护与设计发现契约、当前 `.codex/config.toml` 和 skill 分发方式。相邻调查没有直接回答 agent 与工作区的执行隔离，因此本报告使用空前序关系。

外部实现固定检查 MCPShell `main@da50818e2504f8a7d71c4c0fd82041b5c01d6df8`，该提交形成于 2026-08-12T09:04:12Z。实际读取了其 [README](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/README.md)、[配置说明](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/docs/config.md)、[runner 说明](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/docs/config-runners.md)、[安全说明](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/docs/security.md)、[Codex 接入说明](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/docs/usage-codex-cli.md)以及命令、模板和 server 源码。

调查时 GitHub 标记的最新正式 release 是 [`v0.2.0`](https://github.com/inercia/MCPShell/releases/tag/v0.2.0)，其 tag commit 时间为 2026-02-04T00:18:56+01:00；release 提供 Linux、Darwin 和 Windows 的主要架构制品及 checksums。固定检查的 `main` 已继续更新依赖，本轮不把 `main` 自动视为部署版本。

本轮取得了以下动态证据：

- 使用 Go 1.26.5 对固定提交执行 `go test ./...`，`cmd`、`pkg/command`、`pkg/common`、`pkg/config`、`pkg/server` 和 `pkg/utils` 全部通过；目标模块声明 [Go 1.25.5](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/go.mod)。
- 在一次性本地 Git 目录中构造固定工作区的 `workspace_shell` 和 `workspace_diff`。MCPShell config validate、正常 shell、包含引号与 `=` 的输入、固定 cwd、status、unstaged diff 和 staged diff 均能工作。
- 原始命令非零退出或触发 MCPShell timeout 时，失败前的 stdout/stderr 不会返回。该行为与[执行源码在 runner 返回 error 时丢弃 `commandOutput`](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/pkg/command/command_exec.go#L171-L198)一致。
- 一次性包装实验通过让外层命令成功并在正文中附带退出状态，保留了非零退出和内部 timeout 前的输出。这只证明 workaround 可行，不证明输出协议已经确定。
- 在一次性 `CODEX_HOME` 中验证当前运行时的 `codex mcp add`、`get` 和 `remove`：可以注册 stdio server、读回 command/args，并在删除后清空测试配置。

Codex 侧核对了 2026-09-03 可见的 OpenAI 官方 [用户级与仓库级 skill 位置](https://learn.chatgpt.com/docs/build-skills)、[MCP 配置和 stdio/Streamable HTTP 支持](https://learn.chatgpt.com/docs/extend/mcp)以及[配置层级与信任边界](https://learn.chatgpt.com/docs/config-file/config-basic)。

本轮没有连接真实 SSH 工作区，没有实现参数传输 wrapper，没有通过 Codex 客户端实际调用生成后的两个 MCP tools，也没有验证大命令、多行补丁、大 diff、断连恢复、并发或多人凭据隔离。

## 调查结果与边界

### 当前认识

当前证据支持继续验证该方向，但不足以直接开始实现。

预期结构很小：

```text
个性化 Agent 环境
  -> 用户级 stdio MCPShell
    -> 每次工具调用建立一次 SSH
      -> 隔离工作区的固定项目根
```

MCPShell 适合声明 agent 可发现的工具，SSH 适合承接认证和位置差异。第一版没有必要预先建设通用 backend、容器适配层、远端 MCPShell 服务或 HTTP 部署。

### 候选最小形态

以下内容是下一轮 PoC 的候选，不是已经确认的 skill 契约：

1. **Shell 候选**
   - 工具接收一段 command。
   - 本地 transport 每次启动一个 `ssh -T <alias>`。
   - command 通过 stdin 进入远端固定项目根下的 shell，避免先被本地 shell 或 SSH 命令字符串解释。
   - transport 返回正常输出、远端退出码、timeout 或连接失败。

2. **Diff 候选**
   - 工具只接收有限的 diff 参数，而不是任意 shell。
   - 可先验证 `all`、`worktree`、`staged` 三种 mode 和单个可选 pathspec。
   - 参数作为数据传输，在远端固定项目根直接调用 `git status --short`、`git diff` 和 `git diff --cached`。
   - `git diff` 不包含未跟踪文件内容；status 只能表明其存在。

3. **预实现候选**
   - 一份已经定义两个工具的 MCPShell YAML 模板。
   - 一个供 shell 与 diff 共用的 SSH transport helper。
   - 一个小型初始化 helper，用于填入 SSH alias 和项目根、写入用户域配置并调用 Codex MCP 注册入口。
   - 一个只读或不留项目改动的 smoke test，以及删除对应用户配置的方式。

候选预实现的目标是免除使用者手写 YAML、TOML、SSH quoting、diff 命令和失败输出处理；它不负责创建 SSH 凭据、授予远端权限或管理工作区生命周期。MCPShell 是否由 skill 自动安装暂不决定：现有 release 使自动安装可行，但当前证据没有说明安装是主要摩擦。

### 主要待验证问题

传输比工具声明更值得优先验证：

1. **命令保真**：quotes、换行、here-doc、多行补丁和 shell 特殊字符只能在目标 shell 中解释一次。
2. **参数边界**：diff mode 与 pathspec 必须作为数据传输，不能重新开放任意 Git 参数或第二个 shell 注入面。
3. **失败表达**：需要同时保留 stdout、stderr 和远端退出码，并区分远端非零、命令 timeout、MCPShell timeout 和 SSH 断连。
4. **容量与编码**：需要确定命令、补丁和 diff 的可接受大小、字符编码和截断行为。
5. **固定目标**：日常 tool 参数不得覆盖 SSH host 或项目根；否则桥接不能稳定代表一个隔离工作区。
6. **Git 覆盖面**：需要确认 status、working tree、staged 和未跟踪文件是否足以支持实际审查，还是以后需要独立 read 能力。

MCPShell 的 [Go template](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/pkg/common/templates.go) 不提供自动 shell quoting，因此不能仅凭 YAML 示例推断上述问题已经解决。

### 已确认、推断与未决定

| 强度 | 当前内容 |
| --- | --- |
| 已确认 | MCPShell 能定义并通过 stdio 暴露自定义命令工具；本地固定 cwd 的 shell/diff PoC 可运行；当前版本在外层非零退出时丢失已有输出；当前 Codex CLI 可注册和删除 stdio MCP server。 |
| 有依据的推断 | 一个用户级 MCPShell 加单次 SSH transport 可以让 agent 使用稳定工具名操作固定工作区；工作区实际距离不需要进入 tool schema。 |
| 待验证候选 | command 经 stdin 传输、有限 diff 参数、统一失败结果和小型初始化 helper 能够形成足够可靠的预实现。 |
| 未决定 | 最终 skill 名称、目录与源码 owner、脚本语言、CLI 名称、配置路径、输出 schema、是否自动安装 MCPShell、支持哪些 shell、是否只支持 SSH、是否增加 read/apply_patch。 |

### 进入正式工作的条件

只有满足以下条件并再次取得用户授权后，才把本方向转成正式设计、Change 或实现任务：

1. 在一次性真实 SSH 环境完成 shell 与 diff 端到端 PoC；
2. 证明 multiline/quotes、非零退出、timeout、断连和至少一个代表性补丁能够可靠传输；
3. 确认 diff 的最小参数与输出足以支持真实 Git 审查；
4. 根据 PoC 决定预实现的最小文件集合、错误协议和安装边界；
5. 明确取得创建 skill、修改仓库实现与新增测试的授权。

本报告不要求现在创建 decision record 或 change plan。若下一轮 PoC 失败，应保留失败证据并重新判断 MCPShell、SSH transport 或工具集合，而不是为了兑现当前候选而扩大实现。

### 安全与重新调查边界

`workspace_shell` 本质上拥有目标身份在项目中的写权限；位置被 MCP 掩盖不会降低权限风险。真实使用仍需固定 SSH alias 与项目根、使用合适权限的远端身份，并避免把 secrets 作为 tool 参数或写入报告。

第一版候选使用本地 stdio MCP，不需要 MCPShell HTTP。固定提交的 [`StartHTTP`](https://github.com/inercia/MCPShell/blob/da50818e2504f8a7d71c4c0fd82041b5c01d6df8/pkg/server/server.go#L370-L479) 监听 `:%d`；本轮检查的 handler 路径没有认证或 TLS，并会记录完整请求与响应，因此不能从本报告推出可安全开放共享 HTTP endpoint。

当 Codex MCP 配置、MCPShell 的模板或错误输出、SSH transport 约束，或团队对 agent/workspace 隔离的要求发生变化时，应重新调查。当前报告只能支持“值得进行下一轮真实 SSH PoC”，不能支持“方案已经定型”或“skill 已可安全交付”。
