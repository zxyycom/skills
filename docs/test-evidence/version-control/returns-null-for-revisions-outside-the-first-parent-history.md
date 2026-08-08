### Case VERSION-CONTROL-FIRST-PARENT-RELATION-001: First-parent 历史外的范围不可用
Entry:
- `tools/shared/tests/version-control.test.ts > returns null for revisions outside the first-parent history`
- `bun test --test-name-pattern="^returns null for revisions outside the first-parent history$" ./tools/shared/tests/version-control.test.ts`
Contract:
- First-parent 变化操作只对 `from` 位于 `to` 的 first-parent 历史中的范围返回 revision 列表；位于 merge 第二父链的 `from` 使该范围不可用。
Proves:
- 以 merge 的第二父提交作为 `from` 时返回 `null`，与合法但没有新 revision 的空列表明确区分。
