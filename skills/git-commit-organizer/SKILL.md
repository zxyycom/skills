---
name: git-commit-organizer
description: 整理并创建 Git 提交。Use before preparing any commit, including when Codex is about to inspect a diff, decide commit scope, choose a commit type, write a `type：title` message with bullet details, stage files, or run `git commit`.
---

# Git Commit Organizer

## 目标

审计当前 Git 改动，选择能表达语义影响的提交类型，stage 相关文件，并按固定中文格式创建提交：

```text
<type>：<提交标题>

- 修改内容1
- 修改内容2
```

## 范围判断

1. 默认处理当前仓库工作区中的未提交改动。
2. 用户指定文件、目录或 change 名称时，只处理该范围。
3. 已 staged 内容存在时，先判断是否属于本次请求；属于则纳入提交，不属于则保留并说明。
4. 工作区包含明显无关改动时，只 stage 本次相关文件，并在最终回复中列出保留的无关改动。

## 工作流

1. 检查工作区：
   - 运行 `git status --short`。
   - 用 `git diff --stat` 和必要的局部 `git diff` 理解改动。
   - 若已有 staged 内容，先用 `git diff --cached --stat` 确认它是否属于本次提交。

2. 确定提交范围：
   - 用显式文件路径 stage 与用户请求相关的文件。
   - 对无法归类的改动，先查看 diff；仍无法判断时向用户确认。
   - 若 staged 内容和当前请求冲突，先说明冲突并等待用户决定。

3. 选择提交类型：
   - `feat`：新增或调整用户可见能力、规格能力或正式行为。
   - `fix`：修复错误、冲突、不一致或回归。
   - `plan`：规划、方案、OpenSpec change、proposal、design、tasks、实现路线或审计结论整理。
   - `spec`：协议、schema、契约、示例语义或可验证规格的正式调整。
   - `test`：测试、fixture、验证脚本。
   - `docs`：不改变产品契约、规格能力、实现行为或验证规则的说明性文档。
   - `refactor`：不改变行为的代码结构调整。
   - `chore`：维护、依赖、配置、仓库整理。
   - `build`：构建、打包、发布产物流程。
   - `ci`：持续集成或自动化门禁。
   - 在 AI 主导或规格先行项目中，`docs/`、OpenSpec、schema、示例和测试策略可能是项目计划或产品契约本身；优先使用 `plan` 或 `spec` 表达语义，不默认使用 `docs`。

4. 编写提交信息：
   - 使用中文全角冒号：`type：标题`。
   - 标题用简洁中文，说明本次提交的核心目的，不加句号。
   - 正文使用 2-5 条中文 bullet，每条以 `- ` 开头。
   - 每条 bullet 描述实际 diff 中可观察的改动。
   - 只在实际运行验证后写“验证通过”或命令名称；未运行验证时在最终回复中说明未运行。

5. 提交前复核：
   - 运行 `git diff --cached --stat`。
   - 必要时查看 `git diff --cached` 的关键片段。
   - 确认 staged 文件和提交正文一致。

6. 创建提交：
   - 使用 `git commit -F -` 从 stdin 传入多行提交信息。
   - 提交成功后运行 `git status --short`。
   - 最终回复提交 hash、提交标题、验证情况和是否有未提交残留。

## 提交信息模板

```text
plan：整理 CLI 参数兼容 change 说明

- 优化 standardize-cli-unknown-argument-compatibility 的目标、范围和影响说明
- 明确 warning 在 readable-json 与 protocol-json 等输出层的承载边界
- 同步核心 CLI change 的未知参数兼容和 protocol-json schema 边界
```

## 边界

- Stage 做法：优先使用显式路径；只有用户明确要求提交全部改动且 diff 已确认时，才使用整仓 stage。
- 生成物处理：提交前查看生成物、缓存或日志来源；与请求无关时保留不提交。
- 历史操作：默认创建新提交；只有用户明确要求 amend、rebase 或 reset 时，才执行历史改写类操作。
- 验证表述：最终回复和提交正文只陈述实际运行过的验证。
