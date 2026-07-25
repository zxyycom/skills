# Change Plan 固定结构契约

本文件是 change 目录、固定结构与 CLI 机械行为的唯一精确契约。`SKILL.md` 负责写作、语义审阅、实施门禁和归档授权；本文件只固定工具能够确定性执行的边界。

## Change 目录

1. 每个 change 使用独立目录，目录名必须是小写英文、数字和连字符组成的 kebab-case。
2. 目录必须包含三个普通 Markdown 文件：
   - `proposal.md`
   - `design.md`
   - `tasks.md`
3. 可以在三个必需文件之外增加交付说明或证据文件；附加文件不参与基础结构检查，也不能代替必需文件。
4. Change 根目录位置优先服从目标项目约定；项目没有约定时使用 `changes/`。
5. Change 根目录的直接子目录表示 active change；保留的 `archive/` 目录不是 change，其直接子目录表示 archived change：

   ```text
   <change-root>/
   ├── <active-change-name>/
   └── archive/
       └── <archived-change-name>/
   ```

6. 基础生命周期只发现上述两层普通目录，不递归发现更深层 change，也不把文件或符号链接作为列表成员。

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

脚本安装位置与 change 路径解析基准彼此独立。保持 shell 当前工作目录在目标项目根目录，并用 skill 的实际安装路径调用脚本；以下 `<change-plan-cli>` 表示 `<skill-directory>/scripts/change-plan.mjs`。默认根目录和所有相对路径参数都相对 shell 当前工作目录解析，不相对脚本安装目录解析。

```text
node <change-plan-cli> list [change-root] [--archived | --all] [--json]
node <change-plan-cli> show <change-directory> [--json]
node <change-plan-cli> check <change-directory>
node <change-plan-cli> check <change-directory> --json
node <change-plan-cli> archive <change-directory> [--json]
```

### list

1. 未传 `change-root` 时使用当前工作目录下的 `changes/`。
2. 默认只列 active changes；`--archived` 只列 archived changes；`--all` 先列 active、再列 archived。两个选项互斥。
3. 同一状态内按 change 名称排序。每个条目包含状态、绝对目录、结构有效性和任务完成数；结构无效的成员仍列出并标记为 invalid。
4. Change 根目录缺失、不可访问或不是普通目录时失败。`archive/` 缺失表示没有历史；存在但不可访问或不是普通目录时，查询 archived 或 all 失败。
5. 文本模式输出一行一个摘要；`--json` 输出 `changeRoot`、查询 `status`、`entries` 和根级 `errors`。

### show

1. `show` 接受显式 change 目录，不进行跨根名称搜索。
2. 目标的直接父目录名为 `archive` 时报告 `archived`，否则报告 `active`。
3. 文本模式依次输出名称、状态、绝对目录、任务完成数、结构状态和三个 artifact 的原文；缺失或不可读取的 artifact 使用占位说明。
4. `--json` 输出 `status`、完整 `check` 结果，以及以 artifact 文件名为键的原文或 `null`。
5. 结构无效时仍返回可读取内容和诊断，但命令失败。

### check

1. `check` 接受显式 change 目录，只检查本契约定义的目录名称、三个 artifact、Markdown 结构和任务语法；目录或 artifact 无法检查和读取时返回对应结构诊断。
2. 默认模式把成功摘要写入 stdout，把结构诊断写入 stderr。
3. `--json` 把完整 `ChangePlanCheckResult` 写入 stdout；结构无效时仍返回机器结果。

### archive

1. `archive` 接受显式 active change 目录，不进行跨根名称搜索。CLI 先确认源路径存在、是普通目录、不是符号链接且尚未归档，再读取和检查计划内容。
2. 路径预检通过后必须通过 `check`，且 `completedTaskCount` 必须等于 `taskCount`。
3. 目标是源目录同级的 `archive/<change-name>/`；`archive/` 缺失时创建，已有普通目录时复用。
4. 已位于 `archive/` 的 change、作为符号链接的源目录、非普通归档目录和已经存在的归档目标都拒绝；命令不覆盖目标。
5. 成功时移动整个 change 目录，保留三个必需 artifacts 与全部附加文件。`--json` 返回源目录、归档目录、最终目录、原检查结果和 `archived: true`。
6. 失败时不移动源 change；`--json` 返回 `archived: false` 和可行动错误。路径预检在结构检查前失败时 `check` 为 `null`，其余门禁失败保留检查结果。归档目录创建后若移动失败，CLI 尝试删除仍为空的目录，但不覆盖原始错误。
7. Checkbox 全部完成只是机械门禁。CLI 不判断 proposal 成功标准、开放问题、稳定事实同步、验证证据、实施许可或归档授权。

### 退出码与输出通道

退出码：

1. `0`：命令成功；`list` 中出现 invalid 成员不使发现操作本身失败。
2. `1`：查询根或目标不可用、存在结构诊断，或归档门禁与文件操作失败。
3. `2`：CLI 参数无效。

文本模式把成功结果写入 stdout，把诊断和失败写入 stderr。`--json` 把命令的完整结构结果写入 stdout；目录访问、结构诊断、归档门禁或文件操作失败时仍保留结构结果并返回 `1`。非法参数始终写入 stderr。

公开函数、结果类型与字段见相邻 `scripts/change-plan.d.mts`。CLI 只证明本文件定义的机械条件，不判断事实准确性、方案质量、长期决策归位、验证充分性、开放问题是否真的收敛或实施与归档权限。
