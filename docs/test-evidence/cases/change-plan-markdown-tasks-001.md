### Case CHANGE-PLAN-MARKDOWN-TASKS-001: Markdown 任务统计忽略非任务语境

Tests:
- `test:6126090c72cefe5f10d6bc924593dc7db490d77bda110aeb48b5b6ac886969cb`

Tags:
- `change-plan`

Contract:
- 任务门禁只统计必需 H2 章节内、根级无序列表中的真实 checklist；代码围栏和 HTML 注释中的相似文本不是任务。

Proves:
- 含两个伪 checklist 和三个真实 checklist 的 tasks 只统计三项，其中仅 Readiness 的一项已完成，且不产生伪语法或重复诊断。
