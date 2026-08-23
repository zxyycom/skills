# Proposal

本 Change 让 Change Plan 的单项与集合门禁只作用于仍在维护的 active Change，并把 archived Change 明确留在历史查询边界。

## Why

变更前，`check` 会把 archived Change 强制套用当前 Plan artifact 结构，`check-all --archived` 与 `--all` 也允许再次门禁历史目录。这样一来，归档时已经通过的 Change 会因为后续结构契约演进而重新变成“无效”，归档不再是稳定的历史出口。

归档前仍必须完成结构、任务进度和 Git 基线门禁；归档后只需要能够发现并读取历史记录，不应再对其 metadata、artifact 结构或任务语法作当前契约判断。

## Outcome

`check` 与 `check-all` 只校验 active Change；archived Change 可以通过 `list` 发现、通过 `show` 读取原始 artifacts，但不再产生有效性、stage、任务进度或距离判断。归档动作继续在移动目录前完成最后一次 active Plan 门禁。

## Scope

### Intended Change

- `check <change-directory>` 只接受 active Change；目标位于 `archive/` 时直接报告不适用，且不读取历史 metadata 或 artifacts。
- `check-all [change-root]` 只门禁 active 直接成员，不再提供 archived 或 all 集合选择。
- `archive` 继续在目录移动前使用 active checker，并只在完整 Plan 与全部任务完成时归档。

### Resulting Impacts

- `list --archived/--all` 继续承担历史发现，但 archived entry 只返回身份和路径，不伪造检查结果。
- `show` 对 active Change 返回检查与 artifacts；对 archived Change 返回原始 artifacts，`check` 为 `null`。
- 同步 CLI 帮助、结构化类型、长期决策、skill、固定契约、人类说明、项目工具链、分发产物、原生测试和测试证据。

非目标：不迁移或重写 archived Change，不为历史记录建立另一套校验规则、格式版本、兼容分支或有效性状态。

## Success Criteria

- 任意 archived Change 都不会被 Markdown、metadata、任务或 Git 距离 checker 读取；显式 `check` 只报告该命令不适用于 archived。
- `check-all` 的参数和结果只表达 active 集合；`--archived` 与 `--all` 只属于 `list`。
- `list` 和 `show` 仍可发现与读取 archived Change，但输出不把历史记录表示为 valid、invalid 或当前 Plan。
- 归档前门禁、目录移动安全、active Change 的单项与集合检查保持成立。

## Affected Owners

- `skills/change-plan/` 的行为入口、固定契约与生成 CLI。
- `tools/change-plan/` 的 checker、catalog、类型、CLI 与原生测试。
- `docs/skills/change-plan.md` 与 `docs/decisions/` 的人类说明和长期方向。
- `docs/tooling.md` 的历史 Markdown 校验边界。
- `docs/test-evidence/change-plan/` 的对应原生测试入口 case。
