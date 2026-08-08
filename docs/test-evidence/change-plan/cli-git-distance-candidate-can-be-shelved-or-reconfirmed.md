### Case CHANGE-PLAN-CLI-RECONCILE-001: Git 距离候选可以机械搁置或重新确认
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI Git-distance candidate can be shelved or reconfirmed`
- `bun test --test-name-pattern="^CLI Git-distance candidate can be shelved or reconfirmed$" ./tools/change-plan/tests/run.ts`
Contract:
- 活动 plan 达到固定 Git 距离阈值时，查询必须暴露候选证据；操作者可以用 `reconcile` 接受机械搁置，也可以用 `plan` 在复核后更新基线并继续实施。
Proves:
- 同一组九个低变更提交让两个 plan 成为 `shelve-candidate`；`reconcile` 为其中一个写入 shelved 及相同的 9 提交、9 行和 `git-distance-v1` 证据，`plan` 为另一个更新基线、拒绝重复确认并允许随后进入 implementation。
