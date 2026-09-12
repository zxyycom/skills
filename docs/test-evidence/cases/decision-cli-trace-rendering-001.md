### Case DECISION-CLI-TRACE-RENDERING-001: Decision Trace 分流终端图与 JSON

Tests:
- `test:13cbacbf8f708ef604ee0a800002f608eccc37583b7fa82580a89b7940e3f971`
- `test:1619611d61e3b7c7c261d55400a68d0e44f6a9b5bb0b8d8d17f25dd900a70a83`
- `test:726d9001e7b0b645049094e7b8cdd6731084668bd0710be79ee639b1cacf415b`
- `test:8305ad263de7c37e81d775352e9915dfa6c603d0619736b93eadbc2187da8ec5`
- `test:e6193e829fcdf3e8c88135ec72da5802a8ab869263f566f0c32d445d87352d8f`

Tags:
- `decision-records`

Contract:
- Decision Trace 默认从既有选择结果渲染稳定终端关系图；文本边明确 source、type、target、可选 summary 或缺省标记，并说明只展开切片内边，显式 `--json` 保持稳定 envelope。
- trace-source 的边由节点块承接；仅 context source 的边在事件中按来源展示，同一 context source 的全部局部重划边都保留，summary 使用 JSON 字符串转义。

Proves:
- 默认图回显范围、图层、trace/context、切片内的有向边、缺省标记、frontier 与 blockedEvent，且不把切片外 relation 渲染为图内边。
- 归并和重划的 context source 边不归属到 context target；reallocation context 同时显示 Y→A、Y→B，并转义 summary 中的引号。
- `--json` 保留 trace、context 与 limits 字段，供机器读取同一次查询结果；重复 `--json` 以参数错误退出且不写 stdout。
