### Case VERSION-CONTROL-HEAD-001: 区分未诞生 HEAD 与损坏 HEAD

Tests:
- `test:946b036f7b14171cd2a7350bdbb7b5a80432df715043befad66a9f49c31a3f92`

Tags:
- `version-control`

Contract:
- 尚无提交的合法 HEAD 返回空修订，损坏引用不得伪装为未诞生状态。

Proves:
- 新仓库返回 `null`，非法对象引用返回 `operation-failed`。
