### Case VERSION-CONTROL-FIRST-PARENT-RELATION-001: First-parent 历史外的范围不可用

Tests:
- `test:660142c11cc9f9fb83f0ee7617b7bf2a2bcdf80d6a4ee4bc3bbd99d5ac122751`

Tags:
- `version-control`

Contract:
- First-parent 变化操作只对 `from` 位于 `to` 的 first-parent 历史中的范围返回 revision 列表；位于 merge 第二父链的 `from` 使该范围不可用。

Proves:
- 以 merge 的第二父提交作为 `from` 时返回 `null`，与合法但没有新 revision 的空列表明确区分。
