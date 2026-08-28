# Codex Shell Permissions

`codex-shell-permissions` 用于 Codex shell 命令失败后的下一步执行选择，并在用户主动要求时维护 Codex shell 权限 rules。

默认功能是让 agent 在失败后选对下一步：改用更简单的命令形态、对必要的复杂命令申请提权、确认高风险目标范围，或回到目标程序的真实错误处理。只有用户明确要求添加、修改、审查 Codex shell 权限 rules、`allow/prompt/block` 或 `execpolicy` 行为时，才进入规则维护功能。

## 为什么需要它

Codex 的 shell 命令由沙箱专用的受限身份运行，不继承当前交互用户或管理员的完整权限。该身份通常只能写入自身可写位置和明确 write roots，其他目录可以广泛读取，但仍受 permission profile、文件系统 ACL、受保护路径和程序请求权限约束。因此，“当前用户能访问”不能证明 shell 中的目标程序也能访问。

agent 如果忽略执行身份，只凭失败文本改引号、换 shell、增加 read root 或修改 shell rule，很容易在错误的权限层重复试错，甚至绕过该走的审批。

这个 skill 的价值是让 agent 先按失败阶段处置：创建进程失败就考虑提权，目标程序启动后的路径权限错误就定位拒绝层，组合命令就判断是拆开还是提权一次执行，网络/安装就申请权限，破坏性操作就确认范围并审批，明确业务错误才回到目标程序处理。需要长期改变 shell rule 行为时，再进入 rules 维护路径。

## 内容结构

`SKILL.md` 是双功能入口，保留触发条件、失败后 shell 使用指挥、提权条件和 rules 维护分流。

`skills/codex-shell-permissions/references/rules-and-syntax.md` 只承接复杂 shell 组合和 PowerShell 表达式的处理选择；一般失败分类、提权和授权边界仍由 `SKILL.md` 承接。

`skills/codex-shell-permissions/references/path-permission-diagnosis.md` 用于目标程序已经启动、但文件或目录访问被拒绝的情况，区分执行身份、permission profile、文件系统权限、程序请求权限、隐式路径和 shell rule。

`skills/codex-shell-permissions/references/permission-rules-maintenance.md` 是第二个主要功能的操作手册。它只在用户明确要求或批准后使用，用于处理权限 rules、`allow/prompt/block`、`execpolicy check` 和热加载问题。

`skills/codex-shell-permissions/references/command-examples.md` 保存命令组合试验的形成时证据，不作为当前执行规则。

## 希望形成的能力

它希望让 agent 在遇到 shell 权限问题时，不再直接从“命令能不能跑”下结论，而是快速选择：

1. 在拆成更简单的命令和提权一次执行复杂命令之间选择。
2. 按当前权限规则提权重跑必要命令。
3. 对目标程序启动后的路径错误先确认实际执行身份，再定位拒绝层，而不是把所有权限问题都归给 shell rule。
4. 改成更稳定的 PowerShell/命令形态。
5. 回到真实程序错误处理。
6. 在用户主动要求时进入 Codex rules 权限配置维护。

通过这种处置卡，shell 失败可以被转化成明确下一步，而不是在命令语法、规则配置、路径权限和审批策略之间来回猜测。

## 发展方向

后续优先沉淀能够改变权限层判断、处理动作或完成证据的稳定规则。单次失败和重复示例只作为诊断材料；只有提炼出新的可复用判断时，才更新对应 owner。
