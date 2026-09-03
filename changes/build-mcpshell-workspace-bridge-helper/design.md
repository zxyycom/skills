# Design

本 Draft 先用真实 SSH PoC 固定最小传输行为，再决定辅助工具的源码、输出协议和分发接口；当前候选不构成已确认实现契约。

## Context

- [`MCPShell 工作区桥接前期调查`](../../docs/investigations/evaluate-mcpshell-as-user-scoped-workspace-bridge.md)记录了 agent/workspace 隔离目标、本地 MCPShell PoC、失败输出缺陷和真实 SSH 未验证边界。
- MCPShell 能通过 YAML 定义 command tool，并可把模板化参数传给执行环境；它不自动解决 shell quoting、SSH 传输、远端 cwd 或 Git 参数边界。
- 当前 MCPShell 在 runner 返回 error 时不返回已经产生的 command output。辅助工具需要验证可接受的上游修复或兼容包装，不能让失败的构建和测试只剩退出状态。
- 本仓库规定：随 skill 分发的工具实现源码由 `tools/` 承接，构建适配由根 `scripts/` 承接，实际分发产物由目标 `skills/` 目录承接。具体路径要在进入 Plan 前与消费它的 skill Change 对齐。
- [`add-mcpshell-workspace-bootstrap-skill`](../add-mcpshell-workspace-bootstrap-skill/) 是下游消费者；本 Change 先拥有 transport 和确定性工具行为，不拥有 agent 何时触发 skill 或怎样取得外部写入授权。

## Goals / Non-Goals

目标：

- 通过真实 SSH 环境验证每次工具调用只建立一次 SSH 的可行性。
- 让 shell command 只在目标 shell 中解释一次，并覆盖 quotes、换行、here-doc 和代表性多行补丁。
- 让 diff 只接受受限数据参数，并在固定项目根调用远端 Git，而不是开放第二个任意 shell。
- 保留 stdout、stderr、远端退出码，并区分命令非零、命令超时、MCPShell timeout 和 SSH 断连。
- 形成可由下游 skill 打包和调用的辅助工具源码、测试及构建边界。

非目标：

- 不创建或管理 SSH 密钥、远端账号、项目权限或工作区生命周期。
- 不建设通用 remote execution 平台、adapter registry、同步文件系统或交互式 PTY。
- 不部署远端 MCPShell server，不开放 MCPShell HTTP endpoint。
- 不在本 Change 中创建最终 skill、定义其触发说明或修改真实用户级 Codex 配置。
- 不预先增加 `read`、`apply_patch` 等工具；只有 shell/diff 的真实证据不足时再调整范围。

## Decisions

### Intended Change

当前拟采用以下顺序，所有接口细节在 PoC 前均为暂定：

1. 建立一次性 SSH 测试目标和 Git fixture，先独立验证 stdin、stdout/stderr、退出状态、timeout、断连与固定 cwd。
2. 为 shell 设计一条不经过本地二次 shell 解释的传输路径；候选是 MCPShell 通过环境值把 command 交给本地 helper，helper 再通过 SSH stdin 送入远端 shell。
3. 为 diff 设计独立 operation；候选参数是 `all`、`worktree`、`staged` mode 与单个可选 pathspec，由 helper 作为数据传入固定的远端 Git 命令。
4. 根据 MCPShell 错误输出实测选择最小结果协议；若外层必须成功才能保留输出，结果必须显式表达远端退出状态和 transport failure，不能把正文返回误判成命令成功。
5. PoC 闭合后再确定 `tools/` 源码入口、测试入口、根构建适配和供 skill 分发的生成产物；进入 Plan 时派生完整 tasks。

### Resulting Impacts

- **工具源码：** 预计新增一个 `tools/` owner，承接 SSH transport、shell/diff operation 和稳定结果；具体目录名、语言和 public CLI 尚未确认。
- **构建与分发：** 若下游 skill 需要可执行脚本或模板，根构建适配必须从工具源码生成或复制受控产物，并由 skill Change 接入其分发单元。
- **测试证据：** PoC 与后续实现需要覆盖正常、非零、timeout、断连、quotes/multiline、固定 cwd、working tree/staged/pathspec；新增最小原生测试入口时同步 Test Evidence ledger。
- **安全：** 工具必须固定 SSH target 与项目根，避免把 host 和任意绝对路径暴露为日常 MCP 参数；真实项目写入仍服从调用者授权。
- **上游兼容：** MCPShell 模板、env 参数或错误输出行为变化时，需要兼容测试；当前 main 或 release 不能未经固定就进入分发契约。

## Risks / Trade-offs

| 风险或取舍 | Draft 中的处理 |
| --- | --- |
| SSH 会经远端 shell 再解释命令参数 | 优先用 stdin 传输脚本，并用包含 quotes、换行和补丁的 PoC 证明只解释一次 |
| 外层成功包装可能掩盖远端失败 | 结果必须携带机器可判断的状态；在下游 skill 验证 agent 不会忽略失败字段 |
| 分离 stdout/stderr 与保留时序可能互相冲突 | 先记录真实消费需要，再选择分流或合流；不在 Draft 假定两者可同时无损 |
| 大命令和大 diff 可能碰到 env、SSH 或 MCP 输出限制 | PoC 测量代表性上限并明确截断，不宣称无限容量 |
| 工具与 skill 分开会增加交接边界 | 本 Change 只拥有确定性传输和 operation；skill Change 明确依赖并只拥有触发、授权与使用流程 |

## Open Questions

1. shell command 从 MCPShell 到 helper 应通过模板化 env、临时 stdin protocol，还是其他不会触发本地二次解释的通道？
2. 结果应使用 JSON envelope、文本 sentinel，还是等待/贡献 MCPShell 上游错误输出修复？
3. diff 的单个 pathspec 是否足够；是否需要 status 与 diff 分离，或支持多个 pathspec？
4. 第一版远端 shell 只支持 POSIX `sh`，还是明确依赖 `bash` 以支持预期补丁和脚本？
5. 初始化配置渲染和 `codex mcp add/remove` 应由本工具提供，还是由下游 skill 的独立 bootstrap script 承接？
6. 真实 SSH PoC 使用什么隔离环境，才能验证断连与 timeout 而不触及生产主机？

## Draft Handoff

后续恢复本 Change 时按以下顺序处理：

1. 先读取前期调查和本 Draft，确认当前没有 Plan、tasks 或实施授权。
2. 在取得一次性外部环境授权后，选择不会触及生产项目的 SSH PoC 目标；PoC 是进入 Plan 前的第一项证据，不等于开始正式实现。
3. 用 PoC 回答 Open Questions 1—4，并向下游 skill Draft 交付四项可复核结果：helper 调用面、shell/diff 参数边界、失败结果语义、代表性容量与限制。
4. 再确定源码、构建、分发和测试 owner，补全 Plan proposal 与 tasks；无法闭合传输时保持 Draft，并把失败证据回写本设计。
