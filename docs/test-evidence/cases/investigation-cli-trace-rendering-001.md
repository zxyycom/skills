### Case INVESTIGATION-CLI-TRACE-RENDERING-001: Investigation Trace 分流终端图与 JSON

Tests:
- `test:648250bbcb8e4fdc9315bcaf33ee0e241a3eaba4c10873617caecb89a2be0010`

Tags:
- `investigation-report`

Contract:
- Investigation Trace 默认从既有选择结果渲染稳定终端关系图；文本边展示 source、type、target、JSON 转义的摘要或缺省标记，并说明只展开切片内边；显式 `--json` 保持稳定 JSON envelope。

Proves:
- 默认图展示图层、普通前后继、拆分 context 的有向边、缺省标记与带引号摘要、受预算阻断的 coverage、frontier、blockedEvent，`--json` 仍保留原始 relation 和 contextIds。
