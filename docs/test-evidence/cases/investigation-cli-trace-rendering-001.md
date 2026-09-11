### Case INVESTIGATION-CLI-TRACE-RENDERING-001: Investigation Trace 分流终端图与 JSON

Tests:
- `test:26218bab6d3b7c6c6c0333db0a9267380868cec42ebbbe130c1532fb590a6970`
- `test:8e265388bdccdaaaa216f00df7d1c3714619566e75194917ed02b6a43b610b0a`

Tags:
- `investigation-report`

Contract:
- Investigation Trace 默认从既有选择结果渲染稳定终端关系图；显式 `--json` 保持稳定 JSON envelope。

Proves:
- 默认图展示图层、普通前后继、拆分 context、summary 与受预算阻断的 coverage、frontier、blockedEvent，`--json` 仍返回 contextIds。
- 图层先按数值 depth 升序，再按成员 ID 稳定排列，因此词法更早的后继不会出现在 L0 anchor 之前。
