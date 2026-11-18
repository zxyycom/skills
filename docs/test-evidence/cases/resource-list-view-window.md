### Case RESOURCE-LIST-VIEW-WINDOW-001: 摘要与树保留同一筛选分页窗口

Tests:
- `test:23800131f1ec20286bc61fa851e5f8c5ae5e22f9987c0ec205880b0a2ec46a48`

Tags:
- `resource-records`

Contract:
- 两种文本视图只渲染按筛选、ID 排序和分页所得的窗口；树的祖先上下文不计入命中。无视图时保留普通 JSON，显式 `--json` 保持机器结果。

Proves:
- 对集合后代及资源类型组合筛选，摘要与树逐页只显示预期 ID 和归属；窗口外无命中或多余上下文，total、offset、limit 与 unchecked freshness 不因视图改变。
- 首页面含正确转义的中文多行标题，并可按同一 ID 用 show 回读原始标题；树按根到父集合的顺序显示对应上下文与深度。
- 两种视图带 `--json` 时与无视图的机器 envelope 相等，首个窗口的无视图普通输出可读为同一个完整结果。
