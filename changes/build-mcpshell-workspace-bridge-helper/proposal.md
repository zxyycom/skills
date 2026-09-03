# Proposal

本 Draft Change 为构建一个供 MCPShell 调用的工作区桥接辅助工具做准备，候选方向是以单次 SSH 传输承接远端 shell 与 Git diff。

## Why

个性化 agent 环境与协作项目工作区分离后，日常 shell、文件修改和 diff 需要跨执行边界完成。MCPShell 可以声明工具，但命令与参数如何通过 SSH 保真传输、如何保留失败输出，以及如何固定目标工作区，仍需要一份可复用实现；若把这些细节留给 skill 或每位使用者临场拼接，会重复制造 quoting、退出状态和断连处理问题。

前期调查只验证了本地固定目录中的 MCPShell shell/diff，并发现当前版本在外层命令非零时丢失已有输出。真实 SSH transport 尚未验证，因此本 Change 先保持 Draft，以端到端 PoC 和最小传输契约作为进入 Plan 的前置。

## Outcome

仓库拥有一项可独立测试的 MCPShell 工作区桥接辅助能力：它能把 shell command 或受限 diff 参数通过一次 SSH 调用送入固定项目根，并向调用方保留正常输出、远端退出状态、超时与连接失败。该能力提供后续 skill 可分发的确定性实现，而不要求使用者手写 SSH quoting 或 Git diff 命令。
