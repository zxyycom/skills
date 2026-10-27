# Command Combination Trials

本文件只保存不同 shell 命令组合的形成时证据，不是当前执行规则 owner，也不是一般故障案例库。当前分类和处理规则以 [SKILL.md](../SKILL.md) 与 [rules-and-syntax.md](rules-and-syntax.md) 为准；本文件与它们冲突时，不能用历史观察覆盖当前规则。

只有当前组合与既有记录相近、且需要核对形成时观察或证据状态时才读取。先确认条目是已实测、环境规则、观察摘要还是待补测；待补测和未保留完整输出的条目不能作为已验证规则。规则检查和 sandbox 对照只记录实际做过的结果。

## 环境信息

以下环境用于理解已观察记录的适用范围；迁移到其他平台、shell 或 Codex 版本后，新增记录应补充当时环境。

1. 采集时间：2026-07-08T16:12:37.0314554+08:00。
2. 平台：Microsoft Windows 11 家庭版 中文版，10.0.26200，64 位。
3. Shell：PowerShell ConsoleHost 7.6.3。
4. Codex 使用场景：Codex 桌面端。
5. Codex 桌面端包版本：OpenAI.Codex 26.623.19656.0；进程文件版本：149.0.7827.197。
6. Codex CLI：codex-cli 0.142.1，仅记录 shell 中 `codex` 命令版本，不代表桌面端版本。

## 记录格式

新增记录必须保留结果状态：

```text
组合类型: <管道 + 逗号参数 / 管道 + 脚本块 / 变量 + 重定向 / ...>
尝试形态: <脱敏后的命令形态>
shell_command 结果: <已观察输出 / 未保留输出 / 未测>
结论: <直接用 / 拆开用 / 提权一次执行 / 需要确认 / 只用于对照 / 不要用>
证据状态: <已实测 / 环境规则 / 观察摘要 / 待补测>
```

实际做过 `execpolicy check` 或 `codex sandbox powershell` 对照时，可以在对应记录里补充结果；未做过时不要为了补字段而主动执行。

记录中的“拆开用”表示排查或风险不清时的保守路径；如果整条复杂命令的目的、目标范围和副作用都清楚，且一次执行更适合当前任务，可以按环境规则提权执行。

不要写一次性路径、临时文件名或机器专属绝对路径。需要路径时使用 `<workspace>`、`<file>`、`<rule-file>`。

## 组合记录

### execpolicy 多规则叠加

组合类型：具体 allow + 宽泛 prompt。

尝试形态：

```powershell
codex execpolicy check --pretty `
  --rules <readonly.rules> `
  --rules <prompt.rules> `
  <program> <arg1>
```

shell_command 结果：规则检查命令不执行被检查命令。

execpolicy check 结果：已观察到具体 allow 和宽泛 prompt 同时匹配时，最终 decision 可能仍是 `prompt`。

codex sandbox powershell 结果：不适用。

结论：以最终 decision 为准。`prompt` 就审批；`block` 就不要执行；需要长期改变行为时调整 rule。

证据状态：已实测。
