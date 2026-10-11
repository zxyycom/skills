### Case GRAPH-ITERATOR-RESTORE-001: 继承 iterator 改变及恢复不遗漏 direct 晋升

Tests:
- `test:968ee87587d210009973292e96b6bab1c9b0dd19b0176c236531b87922aa79ba`

Tags:
- `relation-graph`

Contract:
- 继承 Array iterator 改变时走动态快照，恢复后仅复用已证明成员事实，direct 晋升继续独立执行。

Proves:
- 标准 iterator 接纳 a、改变期间到达 b、恢复后另一稳定 direct 单位到达 c，最终四成员全部 trace 且无截断。
