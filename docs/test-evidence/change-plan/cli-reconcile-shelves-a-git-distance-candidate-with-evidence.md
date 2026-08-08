### Case CHANGE-PLAN-CLI-RECONCILE-001: Reconcile CLI 用 Git 距离证据机械搁置候选
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI reconcile shelves a Git-distance candidate with evidence`
- `bun test --test-name-pattern="^CLI reconcile shelves a Git-distance candidate with evidence$" ./tools/change-plan/tests/run.ts`
Contract:
- 活动 plan 达到固定 Git 距离阈值时，查询必须暴露候选证据，`reconcile` 必须据此写入机械搁置状态。
Proves:
- 九个低变更提交产生可见的 `shelve-candidate` 证据，reconcile 成功写入 shelved 阶段及相同的 9 提交、9 行和 `git-distance-v1` 证据。
