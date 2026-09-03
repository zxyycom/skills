# Design

本 Draft 先用真实 SSH PoC 固定 command、patch 和双向单文件的最小传输行为，再决定辅助工具源码、结果协议和分发接口；当前候选不构成已确认实现契约。

## Context

- [`MCPShell 工作区桥接前期调查`](../../docs/investigations/evaluate-mcpshell-as-user-scoped-workspace-bridge.md)记录了 agent/workspace 隔离目标、本地 MCPShell PoC、失败输出缺陷和真实 SSH 未验证边界。
- 核心 skill 需要 command、apply-patch、put 和 get 四项 operations。Git status/diff 由 command operation 在固定 project root 中执行。
- put/get 在 agent staging 与 project 之间按方向传输单个文件。
- MCPShell 能通过 YAML 定义 command tool，并可把模板化参数传给执行环境；它不自动解决 shell quoting、patch payload、SSH 传输、远端 cwd、路径边界或文件字节流。
- 当前 MCPShell 在 runner 返回 error 时不返回已经产生的 command output。辅助工具需要验证上游修复或兼容包装，不能让失败的构建、测试或 patch 只剩模糊错误。
- 本仓库规定：随 skill 分发的工具实现源码由 `tools/` 承接，构建适配由根 `scripts/` 承接，实际分发产物由目标 `skills/` 目录承接。
- [`add-mcpshell-workspace-tools-skill`](../archive/add-mcpshell-workspace-tools-skill/) 是下游消费者；本 Change 拥有 transport 和确定性 operation，不拥有 AI 触发或外部写入授权。

## Goals / Non-Goals

目标：

- 通过真实 SSH 环境验证每次 tool 调用使用一次有界 transport 的可行性。
- 让 shell command 只在目标 shell 中解释一次，并覆盖 quotes、换行、here-doc、非零退出、timeout 与断连。
- 让 patch payload 作为数据到达固定 project root，由目标侧检查并整体应用，而不是嵌入 shell command。
- 让 put/get 只在固定 agent staging root 与 project root 之间传输单个常规文件，并返回可核对的 byte count 与两端 SHA-256。
- 让路径、覆盖、容量和失败结果足以被下游 AI 判断，并证明失败不会留下部分 patch、半文件或 helper 临时文件。
- 形成可由下游 skill 打包和调用的辅助工具源码、测试及构建边界。

非目标：

- 不创建或管理 SSH 密钥、远端账号、项目权限或工作区生命周期。
- 不建设通用 remote execution platform、adapter registry、目录镜像、自动同步或交互式 PTY。
- 不部署远端 MCPShell server，不开放 MCPShell HTTP endpoint。
- 不在本 Change 中创建最终 skill、定义其触发说明或修改真实用户级 Codex 配置。
- 不增加独立只读 diff、递归复制、解包或任意远端文件系统 tools。

## Decisions

### Intended Change

当前拟采用以下顺序；接口与协议细节在 PoC 前均为暂定：

1. 建立一次性 SSH 测试目标、Git fixture 和独立 agent staging fixture，先验证 stdout/stderr、退出状态、timeout、断连与固定 roots。
2. 为 shell 设计一条不经过本地二次 shell 解释的路径；候选是 MCPShell 把 command 作为数据交给本地 helper，helper 再通过 SSH stdin 送入远端 shell。
3. 为 apply-patch 设计独立 operation；候选输入是单个 `patch` payload。helper 先拒绝绝对路径、`..`、`.git` 与越界 symlink，再让固定项目根中的 `git apply` 检查并应用，不启用 `--unsafe-paths`、`--reject` 或任意 Git 参数。
4. 为 put/get 设计两个方向明确的 operations；参数均为各自 root 下的 `source_path`、`destination_path` 和默认 `false` 的 `replace`。文件内容由 helper 直接读写，不进入 MCP 文本参数或 shell command。
5. 接收端先写 helper 拥有的临时文件，完成 byte count 与 SHA-256 校验后原子落盘。目标已存在、超限、hash 不一致、timeout 或断连都不得留下半文件。
6. 根据 MCPShell 错误输出实测选择最小结果协议；若外层必须成功才能保留信息，结果必须显式表达 operation、目标状态和 failure kind，不能把正文返回误判成成功。
7. PoC 闭合后再确定 `tools/` 源码入口、测试入口、根构建适配和供 skill 分发的生成产物；进入 Plan 时派生完整 tasks。

### Resulting Impacts

- **工具源码：** 预计新增一个 `tools/` owner，承接 SSH transport、shell/apply-patch/put/get operations 和稳定结果；具体目录名、语言与 public CLI 尚未确认。
- **MCPShell 定义：** 下游生成 shell、apply-patch、put 和 get 四项 tool definitions；shell 同时承接 Git status/diff。
- **构建与分发：** 根构建适配从工具源码生成或复制受控产物，再由目标 skill 接入分发单元。
- **测试证据：** 覆盖 command 正常/非零/timeout/断连/quotes/multiline，patch 创建/更新/删除/多文件失败/路径越界，put/get 二进制/空文件/目标已存在/replace/路径与 symlink 越界/容量超限/中断清理。
- **安全：** backend、project root 与 agent staging root 固定在 bridge；日常参数只能给出相对路径或 patch 数据。真实项目和 staging 写入仍服从调用者授权。
- **上游兼容：** MCPShell 模板、env 参数或错误输出行为变化时需要兼容测试；未固定的 main/release 不进入分发契约。

## Risks / Trade-offs

| 风险或取舍 | Draft 中的处理 |
| --- | --- |
| command 或 patch 被本地 shell、SSH command string 再解释 | command/patch 作为数据交给 helper，再经 stdin 或等价通道传入目标；用特殊字符与多行 PoC 证明 |
| `git apply --check` 与实际应用之间存在状态变化 | PoC 比较单次 `git apply` 自身的整体失败行为与显式预检方案，再选择不会留下部分修改的最小路径 |
| MCPShell 外层成功包装掩盖目标失败 | 结果携带机器可判断的 operation status 与 failure kind；下游验证 AI 不忽略状态字段 |
| put source 暴露整个 agent 环境 | source 固定在独立 staging root；拒绝绝对路径、`..` 与 symlink 越界，agent config root 不能成为 staging root |
| get 把 secrets 或整个项目复制到 agent 域 | 单文件、相对路径、按原任务调用；不提供 glob、目录、递归或同步 operation |
| 断连或 replace 失败留下部分文件 | 接收端临时文件、hash 校验、原子落盘和确定性清理 |
| 大 command、patch 或文件碰到参数与输出限制 | 分别测量 command/patch 参数通道和 file stream 上限，明确拒绝或截断行为，不宣称无限容量 |
| 工具与 skill 分开增加交接边界 | 本 Change 只拥有确定性 transport/operation；skill Change 拥有触发、授权和使用流程 |

## Open Questions

1. command 与 patch 从 MCPShell 到 helper 应通过模板化 env、stdin protocol、临时 input file，还是其他不会触发本地二次解释的通道？
2. `git apply` 在创建、删除、多文件和失败场景中的整体性是否足够；是否需要 helper 额外快照或回滚？
3. 结果应使用 JSON envelope、文本 sentinel，还是等待/贡献 MCPShell 上游错误输出修复？
4. put/get 的字节流应复用 `ssh -T` 自定义 protocol、调用 scp/sftp，还是使用其他不要求远端常驻 helper 的方式？
5. agent staging root 应由 provider 创建在用户 cache/runtime 域，还是接受调用者提供的既有受限目录？
6. 第一版远端 shell 只支持 POSIX `sh`，还是明确依赖 `bash`？
7. 初始化配置渲染和 `codex mcp add/remove` 由本工具提供，还是由下游 skill 的独立 bootstrap script 承接？
8. 真实 SSH PoC 使用什么一次性隔离环境，才能验证断连、timeout、patch 与双向文件而不触及生产主机？

## Draft Handoff

1. 恢复本 Change 时先读取前期调查、本 Draft 和下游 skill，确认当前四项 operations 与未验证边界。
2. 在取得一次性外部环境授权后，选择不会触及生产项目的 SSH PoC 目标；PoC 是进入 Plan 前的证据，不等于正式实现。
3. 用 PoC 回答 Open Questions 1—6，并向下游 skill 交付五项结果：helper 调用面、command 传输、patch 整体语义、put/get 字节与路径边界、统一失败与容量限制。
4. 再确定源码、构建、分发和测试 owner，补全 Plan proposal 与 tasks；无法闭合 transport 时保持 Draft，并回写失败证据。
