### Case DECISION-CANDIDATE-NEW-001: New 创建规范未完成 scaffold 且不建立记录

Tests:
- `test:81b6e77dfff3b8da3549e9f85e89e552557c9e075c9ee6658a7a6de3684dde55`

Tags:
- `decision-records`

Contract:
- `new` 从显式规范输入以稳定 field/tag 顺序创建不覆盖 scaffold；创建成功、正文 readiness 与正式建立必须分开报告。

Proves:
- 创建退出 0，stdout 报告路径与未发生的 lifecycle/index 变化，stderr 报告 scaffold/body readiness、后续动作且不附会 mutation outcome。
- 新 Markdown 具有 candidate lifecycle、空固定正文和排序 tags；没有正式索引。
- candidates 与严格 check 分别显示 scaffold/body readiness 计数。
- 重复 identity 退出 1 且保留原字节；非法 ID 退出 2 且不创建路径。
