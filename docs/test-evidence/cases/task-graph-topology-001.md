### Case TASK-GRAPH-TOPOLOGY-001: 父子环、展开依赖环和悬空引用均被识别

Tests:
- `test:6acc1bf79d843359de242da8babf9b948676679fcc2b4c8be29a966e5c8321fe`

Tags:
- `task-graph`

Contract:
- 根级任务字典中的父子森林与继承展开依赖必须无环，关系只能指向现存 task。

Proves:
- 父子环、展开依赖环和悬空引用均被识别。
