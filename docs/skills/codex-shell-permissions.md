# Codex Shell Permissions

`codex-shell-permissions` 用于 Codex shell 命令失败后的下一步执行选择，并在用户主动要求时维护 Codex shell 权限 rules。

默认功能是让 agent 在失败后选对下一步：改用更简单的命令形态、对必要的复杂命令申请提权、确认高风险目标范围，或回到目标程序的真实错误处理。只有用户明确要求添加、修改、审查 Codex shell 权限 rules、`allow/prompt/block` 或 `execpolicy` 行为时，才进入规则维护功能。

## 为什么需要它

Codex 的 shell 工具调用会受到命令形态、权限规则、sandbox、网络和审批策略影响。agent 如果只凭失败文本改引号、换 shell 或随意拼接命令，很容易浪费步骤，甚至绕过该走的审批。

这个 skill 的价值是让 agent 先按常见场景处置：创建进程失败就考虑提权，组合命令就判断是拆开还是提权一次执行，网络/安装就申请权限，破坏性操作就确认范围并审批，目标程序已经启动才回到真实错误处理。需要长期改变权限行为时，再进入 rules 维护路径。

## 内容结构

`SKILL.md` 是双功能入口，保留触发条件、失败后 shell 使用指挥、提权条件和 rules 维护分流。

`skills/codex-shell-permissions/references/rules-and-syntax.md` 是规则和语法速查，列出容易被 runner 或权限规则卡住的命令形态，以及必须提权或确认的命令。

`skills/codex-shell-permissions/references/permission-rules-maintenance.md` 是第二个主要功能的操作手册。它只在用户明确要求或批准后使用，用于处理权限 rules、`allow/prompt/block`、`execpolicy check` 和热加载问题。

`skills/codex-shell-permissions/references/command-examples.md` 是命令组合试验记录，按管道、逗号、脚本块、重定向、变量、子表达式等组合记录尝试形态、观察结果、处理结论和证据状态。

## 希望形成的能力

它希望让 agent 在遇到 shell 权限问题时，不再直接从“命令能不能跑”下结论，而是快速选择：

1. 在拆成更简单的命令和提权一次执行复杂命令之间选择。
2. 按当前权限规则提权重跑必要命令。
3. 改成更稳定的 PowerShell/命令形态。
4. 回到真实程序错误处理。
5. 在用户主动要求时进入 Codex rules 权限配置维护。

通过这种处置卡，shell 失败可以被转化成明确下一步，而不是在命令语法、规则配置和审批策略之间来回猜测。

## 发展方向

后续可以继续沉淀常见失败文本、敏感命令形态、审批边界和 rules 维护经验。命令组合记录优先写成“组合类型 -> 尝试形态 -> shell_command 观察 -> 处理结论 -> 证据状态”；只有影响触发、现场指挥或 rules 维护流程时才更新 skill 入口。
