### Case VERSION-CONTROL-HEAD-001: 区分未诞生 HEAD 与损坏 HEAD

Tests:
- `test:ab1bda5ae407b731e1b491a884bc443e1244dff1604de8889b2c19e9b008ba18`

Tags:
- `version-control`

Contract:
- 尚无提交的合法 HEAD 返回空修订，损坏引用不得伪装为未诞生状态。

Proves:
- 新仓库返回 `null`，非法对象引用返回 `operation-failed`。
