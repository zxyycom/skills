# Codex Shell Permissions

`codex-shell-permissions` 用于 Codex shell 命令失败后的下一步执行选择，并在用户主动要求时维护 Codex shell 权限 rules。

默认功能是让 agent 在失败后选对下一步：改用更简单的命令形态、对必要的复杂命令申请提权、确认高风险目标范围，或回到目标程序的真实错误处理。只有用户明确要求添加、修改、审查 Codex shell 权限 rules、`allow/prompt/block` 或 `execpolicy` 行为时，才进入规则维护功能。

## 为什么需要它

Codex 的 shell 命令由沙箱专用的受限身份运行，不继承当前交互用户或管理员的完整权限。该身份通常只能写入自身可写位置和明确 write roots，其他目录可以广泛读取，但仍受 permission profile、文件系统 ACL、受保护路径和程序请求权限约束。因此，“当前用户能访问”不能证明 shell 中的目标程序也能访问。

agent 如果忽略执行身份，只凭失败文本改引号、换 shell、增加 read root 或修改 shell rule，很容易在错误的权限层重复试错，甚至绕过该走的审批。

这个 skill 的价值是让 agent 先按失败阶段处置：创建进程失败就考虑提权，目标程序启动后的路径权限错误就定位拒绝层，组合命令就判断是拆开还是提权一次执行，网络/安装就申请权限，破坏性操作就确认范围并审批，明确业务错误才回到目标程序处理。需要长期改变 shell rule 行为时，再进入 rules 维护路径。

## 阅读入口

[SKILL.md](../../skills/codex-shell-permissions/SKILL.md) 是执行与分流入口。目标程序启动后发生路径拒绝时，读取[路径权限诊断](../../skills/codex-shell-permissions/references/path-permission-diagnosis.md)；复杂 shell 组合和 PowerShell 表达式的选择见[规则与语法](../../skills/codex-shell-permissions/references/rules-and-syntax.md)。用户明确要求或批准维护 rules 时，读取[权限规则维护](../../skills/codex-shell-permissions/references/permission-rules-maintenance.md)。[命令示例](../../skills/codex-shell-permissions/references/command-examples.md)是形成时证据，不是当前执行规则。

## 发展方向

后续优先沉淀能够改变权限层判断、处理动作或完成证据的稳定规则。单次失败和重复示例只作为诊断材料；只有提炼出新的可复用判断时，才更新对应 owner。
