### Case DECISION-NATIVE-BUILD-RELATIONS-001: 原生构建后验证完整领域关系图

Tests:
- `test:1485e8f104936cefa55fddb1d0195c5dbcf2ed9c459492faae1e00eb3625f767`
- `test:d0e8607153957bc765119ffa5bbdf0deed94952e55c77dc41bd158408293c76f`

Tags:
- `decision-records`

Contract:
- Decision 关系图及所选同步组合投影不得接纳不存在的 target 或自环。

Proves:
- 原生 selected 投影构建拒绝指向不存在 ID 的关系；独立的已建立索引图拒绝自环。节点不宣称旧 TS 错误码或路径细节。
