---
name: codex-shell-permissions
description: >-
  当 shell_command、exec 或其他 shell 工具调用出现 sandbox、approval、permission、
  execpolicy、CreateProcessAsUserW failed: 5、网络/registry/DNS 权限失败、复杂 shell
  组合、PowerShell 引号/变量/数组/脚本块相关失败，或用户要求处理 shell 权限 rules、
  allow/prompt/block、execpolicy 时使用。这里包含 shell 失败场景、命令组合与语法限制、
  提权边界、权限 rules 维护和过往命令组合尝试记录的文档。
metadata:
  version: "1"
---

# Codex Shell Permissions

## 目标

本 skill 有两个主要功能：

1. shell 失败后的执行指挥：让 agent 停止重复试错，把失败现象映射到下一条 shell 使用方式，例如拆成简单命令、对必要的复杂命令申请提权、缩小破坏性操作范围，或回到真实程序错误处理。
2. Codex rules 维护：在用户明确要求调整或审查权限 rules 时，指导 agent 维护 `execpolicy` 和 `allow/prompt/block` 等配置，并留下可追踪记录。

默认走第一条路径。只有用户主动要求维护 rules，或已经批准把问题升级为长期规则维护时，才进入第二条路径。

## 失败后指挥 shell 使用

1. 目标程序已经启动并返回测试、编译、Git、Bun、Python 或 PowerShell 的明确业务错误：处理真实错误。
2. 失败文本包含 `CreateProcessAsUserW failed: 5`、`sandbox`、`permission`、`approval`、`execpolicy` 或权限规则相关内容：按权限、审批或提权场景处理。
3. 命令包含管道、分号、`&&`、`||`、重定向、变量展开、通配符、子表达式、脚本块、数组、哈希表或逗号参数列表：先判断是拆成简单调用，还是按风险提权执行整条复杂命令。
4. 命令会写文件、删文件、移动文件、安装依赖、访问网络、启动服务、登录、改配置或写工作区外路径：按风险确认、审批或提权。
5. 选中一个场景后执行对应动作，不要连续尝试多个同类 shell 变体。

## 常见场景和处理方案

1. `CreateProcessAsUserW failed: 5`：
   - 判断：通常是 runner/sandbox 创建进程或权限问题，不是 PowerShell 语法证据。
   - 动作：如果命令对任务必要，按当前环境规则用 `require_escalated` 重跑同一命令，并写清为什么需要提权。
   - 不要：反复改 PowerShell 引号、数组或脚本块来猜。

2. `approval`、`prompt`、`requires approval`：
   - 判断：策略要求审批，不是命令失败。
   - 动作：需要执行就发起审批；不需要执行就换成已允许的只读命令。
   - 不要：把命令改写成绕过审批的形式。

3. 网络、下载、安装、registry、DNS、host resolution 失败：
   - 判断：大概率需要网络权限或审批。
   - 动作：如果是完成任务所必需，按当前环境规则提权重跑。
   - 不要：用临时脚本、代理命令或 shell 拼接绕过网络限制。

4. 删除、递归移动、`git reset`、清理目录、写系统路径或工作区外路径：
   - 判断：破坏性或越界操作。
   - 动作：必须显式审批；递归删除或移动前先确认解析后的绝对路径仍在目标范围内。
   - 不要：用 `cmd /c`、子 shell、通配符或字符串拼接执行删除。

5. 命令含管道、分号、`&&`、`||`、重定向或子 shell：
   - 判断：这是组合命令问题，外层权限匹配可能和真实 shell 语法不是同一件事。
   - 动作：排查阶段或风险边界不清时，拆成多次简单命令；如果组合命令本身是当前任务的自然执行单元、目标范围清楚、一次执行更可靠或更省步骤，可以按当前环境规则用 `require_escalated` 执行整条命令。
   - 不要：为了绕过审批而嵌套更多 shell，或在同一类复杂写法之间反复试错。

6. 命令含 PowerShell 数组、哈希表、脚本块、复杂引号、`$()`、变量展开或逗号参数列表：
   - 判断：PowerShell 可能合法，但外层 runner 或 rule 匹配可能不接受。
   - 动作：能自然改成普通参数就改；复杂表达式确实能更清楚地完成任务，且写入、删除、网络或配置风险都已说明时，可以提权执行原命令。
   - 不要：继续调整引号、脚本块或数组写法来碰运气，也不要把高风险动作藏进复杂表达式。

7. 目标程序已经启动并返回清晰错误：
   - 判断：这时通常不是 shell 权限问题。
   - 动作：按目标程序错误修复，例如参数、路径、依赖、测试失败或编译错误。
   - 不要：继续围绕 sandbox 猜测。

## 哪些情况要提权

按当前环境规则申请 `require_escalated`：

1. 重要命令因 sandbox、创建进程、网络、DNS、registry 或权限错误失败。
2. 命令需要下载、安装、更新依赖或访问外网。
3. 命令需要写工作区外路径、系统目录、用户全局配置或工具缓存。
4. 命令会启动服务、打开 GUI、登录账号、修改系统/工具配置。
5. 用户明确要求执行的破坏性操作，且已经确认目标范围。
6. 复杂 shell 组合因 runner、sandbox 或权限匹配失败，但命令意图明确、目标范围清楚，且一次执行比拆成多步更合适。

提权时要写具体理由，说明为什么这是完成当前任务所必需；普通失败处理不进入持久权限规则配置。

## 什么时候读引用

1. 当前命令涉及复杂 shell 组合，且本文件的常见场景不足以判断时，读 [rules-and-syntax.md](references/rules-and-syntax.md)。
2. 用户明确要求添加、修改或审查 Codex shell 权限 rules、allow/prompt/block 和 execpolicy 行为时，读 [permission-rules-maintenance.md](references/permission-rules-maintenance.md)，并把它作为第二个主要功能处理。
3. 需要对照管道、逗号参数列表、脚本块、重定向、变量和子表达式等组合尝试及结果状态时，读 [command-examples.md](references/command-examples.md)。
4. 普通一次性 shell 失败优先按本文件处理，不必展开引用。
