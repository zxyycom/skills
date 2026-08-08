### Case CHANGE-PLAN-MARKDOWN-TASKS-001: Markdown 任务统计忽略非任务语境
Entry:
- `tools/change-plan/tests/markdown.test.ts > Markdown task counting ignores fenced and commented checklist lookalikes`
- `bun test --test-name-pattern="^Markdown task counting ignores fenced and commented checklist lookalikes$" ./tools/change-plan/tests/run.ts`
Contract:
- 任务门禁只统计必需 H2 章节内、根级无序列表中的真实 checklist；代码围栏和 HTML 注释中的相似文本不是任务。
Proves:
- 含两个伪 checklist 和三个真实 checklist 的 tasks 只统计三项，其中仅 Readiness 的一项已完成，且不产生伪语法或重复诊断。
