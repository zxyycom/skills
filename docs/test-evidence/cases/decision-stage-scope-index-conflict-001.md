### Case DECISION-STAGE-SCOPE-INDEX-CONFLICT-001: stage --scope index composes with a pending index that already differs from the revision

Tests:
- `test:a0f7e8d91d7cab17bf5ef5c757033826305a9f83f591226e2057905066410af4`

Tags:
- `decision-records`

Contract:
- index scope 以合法 pending 索引为组合基底，用本次所选的发布投影替换对应条目，未选 pending 条目保持。

Proves:
- 真实 Git 中以已有 pending 索引为基底，刷新 alpha 的工作区投影，保留 beta 已暂存投影及无关 pending；该节点调用原生 stage 接口。
