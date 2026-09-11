### Case VERSION-CONTROL-HEAD-001: 区分未诞生 HEAD 与损坏 HEAD

Tests:
- `test:745b4474957d0c3c05651a72b3d6b39cab5fd73cf1c39e5eabf3ea1f428a04d8`

Tags:
- `version-control`

Contract:
- 尚无提交的合法 HEAD 返回空修订，损坏引用不得伪装为未诞生状态。

Proves:
- 新仓库返回 `null`，非法对象引用返回 `operation-failed`。
