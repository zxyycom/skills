# Design

本设计在现有单 Change checker 与 catalog 发现能力之上增加显式集合门禁，不复制校验规则，也不改变发现命令的成功含义。

## Context

- `checkChangePlanDirectory` 是单 Change 机械检查的唯一实现，输出完整 metadata、assessment、任务进度和诊断。
- `listChangePlans` 已按 change root、active/archive 位置、符号链接和排序规则发现目录，并为每个条目调用同一个 checker。
- `list` 的责任是即使成员无效也保持可发现，因此它只在根级发现失败时返回退出码 `1`。
- 固定契约目前只定义显式单目录 `check`，没有能够直接作为自动化门禁的集合结果。

## Goals / Non-Goals

目标：

- 用一个稳定命令检查一个 change root 中所选生命周期集合的全部 Change。
- 让集合有效性、计数、逐项结果和退出状态来自同一个聚合结果。
- 保持目录发现、单项校验和 CLI 输出各自只有一个责任 owner。

非目标：

- 推断输入路径是 Change 目录还是 change root。
- 为 archived Change 建立持续兼容承诺。
- 增加 stage 过滤、递归发现或并发配置。

## Decisions

### 1. 使用独立 `check-all` 命令

CLI 增加：

```text
node <change-plan-cli> check-all [change-root] [--archived | --all] [--json]
```

`check <change-directory>` 继续强制一个显式 Change 目录。独立命令让可选的 change root 不会与单目录输入混淆，也让 `--all` 继续只表示“active 与 archived”，而不是兼任“进入批量模式”。

### 2. 集合选择复用 catalog 生命周期范围

`check-all` 默认选择 `active`；`--archived` 选择 `archived`；`--all` 选择两者。三个集合与 `list` 完全一致，且不增加 `--stage`：聚合门禁检查所选生命周期集合的全部成员，而不是允许调用方静默跳过某个 active stage。

Archived 只在显式选择时进入检查。普通持续门禁聚焦当前维护的 active Change，避免历史归档因后续结构规则演进而默认阻断当前工作。

### 3. 从 catalog 结果派生聚合结果

新增聚合函数复用 `listChangePlans` 的根目录检查、直接子目录发现、排序和逐项 checker 结果。返回结构包含：

- `changeRoot`、表示所选集合范围的顶层 `status`、`entries` 和根级 `errors`；
- `checkedCount`、`validCount`、`invalidCount`；
- `valid`，仅在 `errors` 为空且所有成员有效时为 `true`。

空的合法集合满足全称条件并通过；缺失或非法根目录仍由 `errors` 使结果失败。逐项结果保留完整 diagnostics，不建立只有摘要的第二种成员类型。

### 4. 文本与 JSON 使用同一结果决定退出状态

JSON 模式只把完整聚合结果写入 stdout。文本成功在 stdout 输出集合、根目录和计数摘要；失败在 stderr 输出聚合摘要、根级错误，并逐个展开无效成员的现有诊断格式。无论输出模式，`valid` 决定退出码 `0` 或 `1`；参数错误继续使用 `2`。

`list` 仍根据根级 `errors` 决定退出状态，无效成员不会改变发现命令的成功含义。

### 5. 当前 MJS 导出聚合函数但不建立 SDK

聚合函数随现有 runtime 入口导出并进入生成的自包含 MJS，方便当前实现内部复用和测试。与其他直接 import 能力相同，它不获得稳定 SDK、声明文件或跨版本签名承诺；稳定自动化接口仍是 CLI 和 JSON 契约。

## Risks / Trade-offs

- 聚合实现复用 `listChangePlans`，因此目录级 I/O 错误仍按 catalog 的根级错误粒度报告；这保持现有发现边界，但不会为每个无法读取的目录另外建立扫描错误协议。
- `--all` 显式检查 archive 时，旧历史可能因当前 artifact 规则失败；该行为是主动审计的结果，不进入默认 active 门禁。
- 文本模式只展开无效成员，避免大量有效 Change 淹没诊断；完整逐项状态保留在 JSON。

## Open Questions

无。
