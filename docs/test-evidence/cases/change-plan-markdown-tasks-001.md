### Case CHANGE-PLAN-MARKDOWN-TASKS-001: Markdown 任务统计忽略非任务语境

Tests:
- `test:461222b98b0c4104168dd4528da8b38ef08bd32ed63ef75254eecdf9203232cd`

Tags:
- `change-plan`

Contract:
- 任务门禁只统计必需 H2 章节内、根级无序列表中的真实 checklist；代码围栏和 HTML 注释中的相似文本不是任务。

Proves:
- 含两个伪 checklist 和三个真实 checklist 的 tasks 只统计三项，其中仅 Readiness 的一项已完成，且不产生伪语法或重复诊断。
