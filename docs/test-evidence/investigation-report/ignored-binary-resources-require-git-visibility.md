### Case INVESTIGATION-RESOURCE-GIT-VISIBILITY-001: 被忽略的二进制资源仅在引用时失败，强制加入后受管

Entry:
- `tools/investigation-report/tests/resources.test.ts > ignored binary resources fail only when referenced, then become managed after git add -f`
- `bun test --test-name-pattern="^ignored binary resources fail only when referenced, then become managed after git add -f$" ./tools/investigation-report/tests/run.ts`

Contract:
- 被 Git ignore 且未受版本控制管理的资源不能作为报告引用；`git add -f` 后资源成为可引用的受管文件。已受管但未被任何报告引用的资源只产生 warning。

Proves:
- 被 ignore 的二进制资源被引用时，完整验证以版本控制可见性错误失败。
- 强制加入 Git 后，路径过滤验证通过；移除报告引用后，完整验证成功并报告该资源未引用的 warning。
