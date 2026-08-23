# Design

本设计把 active 校验与 archived 历史读取拆成两个明确的数据路径，使归档成为当前契约的终止边界。

## Context

- 变更前，`checkChangePlanDirectory` 通过父目录名识别 archive，并把 archived 强制映射成 Plan artifact contract。
- Catalog 也让 active 与 archived entry 复用 checker，因此 `list`、`show` 和 `check-all` 会隐式读取并校验历史内容。
- `archiveChangePlanDirectory` 已在移动前检查 active Plan、全部任务和路径身份；历史记录不需要再次证明这些归档前条件。

## Goals / Non-Goals

目标：让 checker 只拥有 active Change，让 catalog 以非校验方式发现和读取 archived Change，并让类型与 CLI 输出显式区分两者。

非目标：不提供 archived 审计模式，不保留旧参数兼容，不推断历史 stage，不解析历史 metadata，也不改变 archive 的移动事务。

## Decisions

### Intended Change

- `checkChangePlanDirectory` 在识别到 archive 路径后立即返回 `archived-change-not-checkable`，不检查目录名、metadata、artifacts、tasks 或 Git 距离。
- `checkChangePlanCollection` 固定从 active catalog 结果聚合，不再接收 lifecycle selection；`check-all` 相应只接受可选 change root 与 `--json`。
- `archiveChangePlanDirectory` 保持现有先检查 active Plan、再验证路径身份并移动目录的过程，归档成功结果继续携带移动前的检查证据。

### Resulting Impacts

- `ChangePlanListEntry` 使用 status 判别：active entry 包含完整检查结果，archived entry 只包含 `changeName`、`changeDirectory` 与 `status`。
- `ChangePlanShowResult` 使用 status 判别：active 结果包含 checker，archived 结果以 `check: null` 返回原始 artifacts；历史目录自身不可访问时只报告查询错误，不把 artifact 内容判为无效。
- Catalog 的 archived 列表只枚举真实直接子目录，不读取其中任何文件；历史 `show` 只读取普通 artifact 文件，不读取 metadata、不解析 Markdown，也不跟随符号链接。
- 文本输出对 archived entry 不显示 stage、任务进度、距离或 valid/invalid；历史 show 显示 `Check: not applicable (archived)`。
- 项目工具链只把 archive 前门禁归给 Change Plan；仍在维护的 Change artifacts 同步使用 archived 查询的当前字段，不保留 `stage: null` 或 `metadata: null` 旧投影。

## Risks / Trade-offs

- Archived 内容损坏不会被持续门禁发现；这是历史快照不受当前契约追溯校验的直接结果。需要审计历史时应使用独立的一次性调查，而不是恢复为产品 checker。
- `list --all` 的 entry 形状成为判别联合；调用方必须先读取 `status`，不能假设 archived 具有 active 检查字段。

## Open Questions

无。
