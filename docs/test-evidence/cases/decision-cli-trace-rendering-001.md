### Case DECISION-CLI-TRACE-RENDERING-001: Decision Trace 分流终端图与 JSON

Tests:
- `test:13cbacbf8f708ef604ee0a800002f608eccc37583b7fa82580a89b7940e3f971`
- `test:1619611d61e3b7c7c261d55400a68d0e44f6a9b5bb0b8d8d17f25dd900a70a83`
- `test:8305ad263de7c37e81d775352e9915dfa6c603d0619736b93eadbc2187da8ec5`
- `test:89813570cf43e26157ab36575e39e00f5cfd15b4f8662b3ed9c965a17903367e`

Tags:
- `decision-records`

Contract:
- Decision Trace 默认从既有选择结果渲染稳定终端关系图；显式 `--json` 保持稳定 JSON envelope。

Proves:
- 默认图回显范围、图层、事件中的 trace/context、relation summary、frontier 与 blockedEvent，且不把切片外 relation 渲染为图内边。
- 事件 summary 只随声明该 relation 的 source-side 成员显示，不被 focal member 或其他事件成员借用。
- `--json` 保留 trace、context 与 limits 字段，供机器读取同一次查询结果；重复 `--json` 以参数错误退出且不写 stdout。
