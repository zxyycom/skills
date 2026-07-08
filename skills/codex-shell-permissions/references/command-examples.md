# Command Combination Trials

本文件只记录不同类型 shell 命令组合的尝试形态和结果状态。它不是一般故障案例库，也不解释原理。

使用本文件时，先找相近组合，确认它是已观察、已对照还是待补测；不要把待补测条目当成已验证规则。本文件的重点是“组合形态尝试过什么、结果倾向是什么、后续应怎么用 shell”。规则检查和 sandbox 对照只记录实际做过的结果。

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

### 管道 + 逗号参数列表

组合类型：管道 + 逗号参数。

尝试形态：

```powershell
<producer> a,b,c | <consumer>
<producer> "a","b","c" | <consumer>
```

shell_command 结果：未保留完整输出；历史探索结论是外层 runner 对逗号参数列表和组合命令形态敏感。

execpolicy check 结果：未测完整组合。检查时应把管道两侧按 runner 拆分后的 `<producer>` 和 `<consumer>` 分别检查，不能只检查整条字符串。

codex sandbox powershell 结果：待补测。需要验证 PowerShell 本身是否接受逗号参数时，用 sandbox 对照。

结论：排查时拆开用。整条管道是明确的只读处理或结果汇总，且一次执行更合适时，可以提权一次执行；不要把外层 runner 的失败当成 PowerShell 逗号语法无效。

证据状态：观察摘要。

### 管道 + 脚本块

组合类型：管道 + PowerShell 脚本块。

尝试形态：

```powershell
<producer> | Where-Object { <condition> }
<producer> | ForEach-Object { <action> }
```

shell_command 结果：未保留完整输出；历史探索把脚本块列为外层 runner 敏感形态。

execpolicy check 结果：未测完整组合。只检查管道两侧命令不足以证明脚本块内部动作安全。

codex sandbox powershell 结果：待补测。sandbox 对照只能证明 PowerShell 语法，不代表 runner 权限会放行。

结论：只读过滤在排查时可以拆成简单命令；如果过滤管道本身清楚且一次执行更合适，可以提权一次执行。脚本块内含写入、删除、移动时不要用管道承载。

证据状态：观察摘要。

### 管道 + 删除或移动

组合类型：管道 + 破坏性动作。

尝试形态：

```powershell
Get-ChildItem <path> | Remove-Item
Get-ChildItem <path> | Move-Item -Destination <path>
```

shell_command 结果：待补测。

execpolicy check 结果：待补测。即使枚举命令 allow，删除或移动仍应按破坏性动作处理。

codex sandbox powershell 结果：待补测。

结论：不要用。先只读列出目标，再确认绝对路径和范围，最后对明确路径执行经审批的删除或移动。

证据状态：待补测。

### 逻辑操作符 + 写入动作

组合类型：`&&` / `||` + 写入。

尝试形态：

```powershell
<check-command> && <write-command>
<check-command> || <fallback-write-command>
```

shell_command 结果：按当前 runner 规则，逻辑操作符会让命令被拆成独立片段分别评估。

execpolicy check 结果：前一段 allow 不代表后一段 allow。

codex sandbox powershell 结果：不适用；PowerShell 能解析不代表整条组合应被放行。

结论：排查时拆开用，先运行检查命令，再根据输出决定是否运行写入命令。检查和写入需要作为一个明确执行单元时，可以在说明目标范围后提权一次执行。

证据状态：环境规则。

### 分号 + 多动作串联

组合类型：分号 + 多动作。

尝试形态：

```powershell
<read-command>; <write-command>; <verify-command>
```

shell_command 结果：按当前 runner 规则，命令分隔符会让命令被拆成独立片段分别评估。

execpolicy check 结果：多个动作需要分别检查；不应只看第一段是否 allow。

codex sandbox powershell 结果：不适用。

结论：排查时拆开用，按“读取 -> 修改 -> 验证”分多次调用。动作边界清楚且一次执行更适合时，可以提权一次执行。

证据状态：环境规则。

### 重定向 + 长期源文件写入

组合类型：重定向 + 写文件。

尝试形态：

```powershell
<command> > <file>
<command> >> <file>
```

shell_command 结果：当前权限说明把重定向列为不适合规则自动评估的高级 shell 特性。

execpolicy check 结果：命令本身 allow 不等于写入目标文件合理。

codex sandbox powershell 结果：待补测；语法可执行也不代表适合修改长期源文件。

结论：不要用于长期源文件。源文件修改使用补丁工具；短期日志或明确允许的输出文件按权限规则处理。

证据状态：环境规则。

### 变量展开 + 路径写入

组合类型：变量展开 + 写入/删除/移动。

尝试形态：

```powershell
$target = <path>; <write-command> $target
<write-command> "$env:NAME\<path>"
```

shell_command 结果：历史探索把变量展开列为外层 runner 敏感形态；完整输出未保留。

execpolicy check 结果：未测。权限规则只能看到命令 token 形态，不能替代展开后路径检查。

codex sandbox powershell 结果：待补测，可用于查看变量展开后的真实路径。

结论：涉及写入、删除、移动且目标路径不清时拆开用。目标路径和动作范围已经明确、一次执行更合适时，可以提权一次执行。

证据状态：观察摘要。

### 子表达式 + 命令替换

组合类型：子表达式 + 命令调用。

尝试形态：

```powershell
<command> $(<sub-command>)
```

shell_command 结果：历史探索把子表达式和括号子命令列为外层 runner 敏感形态；完整输出未保留。

execpolicy check 结果：未测。需要分别理解外层命令和子命令。

codex sandbox powershell 结果：待补测，只适合确认 PowerShell 表达式语法。

结论：排查时拆开用，先运行子命令拿结果，再把明确结果作为普通参数传给下一条命令。子表达式只是生成明确参数、且整条命令更适合一次执行时，可以提权一次执行。

证据状态：观察摘要。

### 数组或哈希表 + 命令调用

组合类型：数组/哈希表 + 命令调用。

尝试形态：

```powershell
$items = @("a", "b"); <command> $items
$options = @{ Key = "Value" }; <command> @options
```

shell_command 结果：历史探索把数组和哈希表字面量列为外层 runner 敏感形态；完整输出未保留。

execpolicy check 结果：未测。rule 很难精确表达展开后的真实参数集合。

codex sandbox powershell 结果：待补测，适合确认 PowerShell 展开行为。

结论：优先改成普通参数列表，或把复杂逻辑放进受控脚本文件后运行脚本入口。数组或哈希表能清楚表达参数集合、且一次执行更合适时，可以提权执行原命令；需要写入、网络或安装时仍按提权规则。

证据状态：观察摘要。

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

## 待补测组合

后续遇到新现象时优先补这些组合，并记录 shell_command 观察、处理结论和证据状态：

1. 管道 + 多逗号 + 脚本块。
2. 变量展开 + 通配符 + 删除。
3. 重定向 + 子表达式。
4. `Start-Process` + 参数数组。
5. `codex sandbox powershell` 对复杂组合的通过/失败对照。
