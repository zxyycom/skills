### Case VERSION-CONTROL-FIRST-PARENT-RELATION-001: 拒绝 first-parent 历史外的修订
Entry:
- `tools/shared/tests/version-control.test.ts > rejects revisions outside the first-parent history`
- `bun test --test-name-pattern="^rejects revisions outside the first-parent history$" ./tools/shared/tests/version-control.test.ts`
Contract:
- `from` 必须位于 `to` 的 first-parent 历史中，位于 merge 第二父链不满足该关系。
Proves:
- 以 merge 的第二父提交作为 `from` 时返回稳定的 `revision-not-first-parent`，不会降级为空变化。
