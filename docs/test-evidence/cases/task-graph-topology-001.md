### Case TASK-GRAPH-TOPOLOGY-001: 父子环、展开依赖环和悬空引用均被识别

Tests:
- `test:db1306ba12f9b2853fbc905787d4b22cd848ac7ea0127412e307cfaa90759a0f`

Tags:
- `task-graph`

Contract:
- 根级任务字典中的父子森林与继承展开依赖必须无环，关系只能指向现存 task。

Proves:
- parent cycle、合并 dependency cycle 与 dangling target 分别产生对应图错误，失败不能形成合法图。
