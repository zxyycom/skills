# Change Plan 固定结构契约

本文件是 change 目录与检查器行为的唯一精确契约。`SKILL.md` 负责写作和审阅流程；本文件只固定可机械检查的结构。

## Change 目录

1. 每个 change 使用独立目录，目录名必须是小写英文、数字和连字符组成的 kebab-case。
2. 目录必须包含三个普通 Markdown 文件：
   - `proposal.md`
   - `design.md`
   - `tasks.md`
3. 可以在三个必需文件之外增加交付说明或证据文件；附加文件不参与基础结构检查，也不能代替必需文件。
4. Change 目录位置由目标项目约定；本契约只检查传入的单个目录，不固定项目级 change 根目录。

## 通用 Markdown 规则

1. 每个 artifact 的首个非空行必须是唯一 H1，且标题与下文模板完全一致。
2. H1 与首个 H2 之间必须有非空的 change 摘要。
3. 必需 H2 必须各出现一次，并作为文件开头的 H2 序列按模板顺序排列。
4. 每个必需 H2 必须包含非空语义内容。
5. 必需序列之后可以追加 H2；新增章节不能改变或代替必需章节。
6. 固定标题使用英文以保持结构稳定，正文沿用用户输入语言或项目语言。

## proposal.md

```markdown
# Proposal

<一句话说明 change 的目标和 proposal 的临时计划性质。>

## Why

<当前问题与开展 change 的理由。>

## Outcome

<完成后可以观察到的结果。>

## Scope

<纳入范围与非目标。>

## Success Criteria

<可检查的完成条件。>

## Affected Owners

<需要读取、修改或验证的稳定 owner。>
```

## design.md

```markdown
# Design

<一句话说明兑现 proposal 的设计方向。>

## Context

<已确认事实、约束和必要假设；事实引用原 owner。>

## Goals / Non-Goals

<设计目标与明确不承担的内容。>

## Decisions

<只影响当前 change 的方案和影响；没有独立判断时明确写“无”。>

## Risks / Trade-offs

<会改变实施、权限或验证的风险与取舍。>

## Open Questions

<会改变范围、方案、权限或验收的未决问题；没有时明确写“无”。>
```

需要在实施后保存只属于当前 change 的观察时，可以在必需序列之后追加 `## Implementation Observations`。

## tasks.md

```markdown
# Tasks

<一句话说明任务顺序和完成出口。>

## Readiness

- [ ] 0.1 <实施前的范围、owner、方案或开放问题审计。>

## Implementation

- [ ] 1.1 <具有明确产物或行为结果的实施任务。>

## Verification

- [ ] 2.1 <能够证明受影响边界的验证任务。>
```

任务规则：

1. 三个必需 H2 各包含至少一项任务。
2. 任务必须是顶层 Markdown checkbox，语法为 `- [ ] <id> <description>` 或 `- [x] <id> <description>`。
3. `<id>` 使用至少两段的层级数字，例如 `0.1`、`1.2` 或 `2.1.1`，并在整个文件内唯一。
4. Checkbox 任务只能位于 `Readiness`、`Implementation` 或 `Verification`；附加章节不承接任务。
5. CLI 统计已完成与总任务数，但不从 checkbox 推断计划已获批准或 change 已完成。

## CLI

从 skill 目录或实际安装位置运行：

```text
node scripts/change-plan.mjs check <change-directory>
node scripts/change-plan.mjs check <change-directory> --json
```

退出码：

1. `0`：目录和三个 artifact 通过固定结构检查。
2. `1`：目标可读取，但存在结构诊断，或读取检查发生失败。
3. `2`：CLI 参数无效。

默认模式把成功摘要写入 stdout，把结构诊断写入 stderr。`--json` 把完整结果写入 stdout；结构无效时仍返回 `1`。

检查器只证明本文件定义的机械结构，不判断事实准确性、方案质量、长期决策归位、验证充分性、开放问题是否真的收敛或实施权限。
