---
name: codex-shell-permissions
description: >-
  处理 Codex shell 调用中的 sandbox、approval、execpolicy、文件或目录权限、网络权限
  和复杂 PowerShell 命令失败，并在用户明确要求时维护 shell permission rules。遇到
  CreateProcessAsUserW failed: 5、EPERM/EACCES/Access denied、permission denied，
  或 allow/prompt/block 规则问题时使用。
metadata:
  version: "3"
---

# Codex Shell Permissions

## 目标与路径选择

本 skill 让 agent 根据实际执行身份、原始命令、失败阶段和风险边界选择**一个**可核对的下一步，避免在命令语法、sandbox、审批和 rules 之间重复试错。

1. 默认路径是处理当前 shell 失败：拆成简单命令、对精确命令申请 escalation、确认高风险范围，或转回目标程序错误。
2. 只有用户明确要求添加、修改或审查 `allow/prompt/block`、`prefix_rule` 或 `execpolicy`，或者已经批准把重复问题升级为长期规则维护时，才进入 rules 维护。
3. Shell 命令由沙箱专用的受限身份和 token 执行，不继承当前交互用户或管理员的完整权限。路径访问由该执行身份、本次 permission profile、文件系统 ACL 和程序请求的访问权限共同决定；当前用户能访问某路径，不代表 shell 中的目标程序也能访问。
4. 配置文件、旧调查和其他 task 的结果不能证明本次权限状态；判断当前状态时使用本次实际执行身份、注入的 permission profile、原始命令和完整错误。

## 失败分类与下一步

重试前保留原始命令和完整错误，先判断目标进程是否启动、失败发生在哪个阶段，再从上到下选择首个匹配行。执行该行的下一步后，根据新证据重新分类；不要连续尝试多个同类变体。

| 观察 | 判断 | 下一步 |
| --- | --- | --- |
| runner 或审批输出明确给出 `approval`、`prompt`、`requires approval` | 策略要求审批，不是命令或程序失败 | 命令仍然必要时发起审批；否则改用真正满足任务的已允许只读入口，不改写命令绕过审批 |
| 出现 `CreateProcessAsUserW failed: 5`，目标程序没有启动 | runner/sandbox 创建进程失败，不是 PowerShell 语法证据 | 命令必要且范围清楚时，对完全相同的命令申请 escalation，并说明必要性；不要先改引号、数组或脚本块 |
| 目标程序已启动，并在文件或目录操作上返回 `EPERM`、`EACCES`、`Access denied` 或 `permission denied` | 目标程序已成功启动，但请求的读取、写入、执行、删除或元数据访问被权限边界拒绝 | 保留精确路径和请求动作，对照实际运行身份、当前 profile 与有效 ACL，按 [路径权限诊断](references/path-permission-diagnosis.md) 判断阻止层，再选择精确 escalation、配置修复或布局/工具入口修复 |
| 错误明确包含 network restricted、sandbox 网络拒绝、DNS/host resolution 或 registry 访问权限失败 | 命令所需网络可能被当前权限或审批策略阻止 | 网络访问确为任务所需时按当前工具申请 escalation；不要用代理命令、临时下载脚本或 shell 拼接绕过限制 |
| PowerShell/runner 在管道、分隔符、重定向、变量、脚本块、数组或子表达式处失败 | 外层 runner、权限匹配和 PowerShell 语法需要分开判断 | 读取 [Shell 组合与语法](references/rules-and-syntax.md)，在拆成简单命令和对完整自然执行单元申请 escalation 之间选择 |
| 目标程序已启动，并返回与文件访问、sandbox 或权限无关的明确测试、编译、HTTP 响应、包不存在、认证拒绝、Git、Bun、Python 或 PowerShell 错误 | 目标程序或外部服务的真实错误 | 修复参数、路径、依赖、凭据、服务响应、测试或编译问题；不要继续围绕 sandbox 猜测 |

## 执行动作边界

1. **拆成简单命令**：用于排查失败阶段、各片段风险不同、展开后的路径不清，或删除、移动、覆盖范围尚未确认的情况。
2. **对精确命令申请 escalation**：用于重要命令被 sandbox、权限、网络、创建进程或 runner 匹配阻止，或者命令完成任务必须联网、下载安装、访问 registry/DNS/API、写允许范围外路径、使用用户工具缓存、启动服务或 GUI。命令目标和副作用必须已知，理由必须说明该精确命令为何是当前任务所需。
3. **区分任务授权与工具审批**：用户请求决定动作是否在任务授权范围内，escalation 只处理当前工具的权限或审批。删除、递归移动、`git reset`、覆盖数据、写系统路径或用户全局配置、登录以及其他高风险动作超出既有授权时，必须先确认精确目标、影响和回退边界；不能用一次 escalation 补足用户授权。
4. **不改变长期权限**：一次失败或一次 escalation 不自动进入 rules 维护，也不能表述为 ACL、read root、permission profile 或长期规则已经修复。
5. **不绕过审批**：不要通过 `cmd /c`、额外子 shell、通配符、字符串拼接、重定向或临时脚本隐藏原动作。

## 完成与表述

1. 精确命令经批准后可能使用不同的执行身份或权限上下文；成功只能说明该命令已完成，除非另有直接验证，不说明普通 sandbox 内已可执行。
2. 命令仍被策略阻止时，报告阻止阶段、已确认的命令范围和所需审批或外部状态，不继续试同类改写。
3. 目标程序返回业务错误时，保留它作为新的直接证据并退出权限排查。
4. 修改长期 rules 时，以 [Permission Rules Maintenance](references/permission-rules-maintenance.md) 的 `execpolicy check` 结果和维护记录作为配置证据；只有实际安全执行过代表命令时，才表述真实 runner 行为已经验证。

## 按需引用

| 当前问题 | 读取内容 |
| --- | --- |
| 复杂命令的拆分、PowerShell 语法对照或高风险组合 | [rules-and-syntax.md](references/rules-and-syntax.md) |
| 目标程序已启动，但文件或目录操作被权限拒绝 | [path-permission-diagnosis.md](references/path-permission-diagnosis.md) |
| 用户已要求或批准维护 `allow/prompt/block`、`prefix_rule` 或 `execpolicy` | [permission-rules-maintenance.md](references/permission-rules-maintenance.md) |
| 当前组合与既有试验形态相近，需要核对形成时观察和证据状态 | [command-examples.md](references/command-examples.md)；该文件是证据记录，不是当前规则 owner |
