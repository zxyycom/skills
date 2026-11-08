### Case DECISION-EVOLVE-GROUPED-SOURCE-SELECTION-001: 分组来源与摘要绑定

Tests:
- `test:0eb416053745392aa788afdaf7afae9ca3f98c37557502cfd1b5e4cf62c6e2e3`
- `test:a51add96ff5c152491d6cfbba545b2a77f90f98621cb84a23d7d0a1ebd0ef5ff`

Tags:
- `decision-records`

Contract:
- 分组 source 必须属于选定后继；摘要须绑定该组关系目标，解析后的来源与目标不得重复。

Proves:
- 原生预检分别拒绝未选候选作为分组 source 和将摘要绑到另一已存在目标，错误码分别为 relation-source、relation-summary，选中候选和索引字节不变。
- 共享关系计划单独拒绝重复解析后的 source 和同一目标的不同类型边；未在同一次 evolve 中穷举别名组合。
