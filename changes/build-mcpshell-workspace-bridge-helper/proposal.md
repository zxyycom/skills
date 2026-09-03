# Proposal

本 Draft Change 为构建一个供 MCPShell 调用的工作区桥接辅助工具做准备，候选方向是以 SSH transport 承接远端 shell、apply-patch 与双向单文件传输。

## Why

个性化 agent 环境与协作项目工作区分离后，命令执行、编码修改和文件实体移动都需要跨执行边界完成。MCPShell 可以声明工具，但 command 与 patch 怎样只在目标环境解释或消费一次、文件字节怎样双向保真传输、失败输出怎样保留，以及两个 roots 怎样固定，仍需要可复用实现。

前期调查验证了 MCPShell 自定义 command、本地固定目录和 Git 输出，并发现当前版本在外层命令非零时丢失已有输出。真实 SSH、apply-patch 和双向文件 transport 均缺少证据，因此本 Change 保持 Draft。

## Outcome

仓库拥有一项可独立测试的 MCPShell 工作区桥接辅助能力：它为固定 project root 提供 command 执行和整体 patch 应用，并在固定 project root 与 agent staging root 之间按方向传输单个常规文件。调用方能够判断目标退出状态、patch 结果、byte count、两端 SHA-256、目标已存在、路径拒绝、timeout 与 transport failure，而不必手写 SSH quoting、临时 patch 命令或文件编码管道。
