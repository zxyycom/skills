### Case CHANGE-PLAN-GIT-BASE-001: Git 距离拒绝缺失与非第一父基线
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance reports unavailable missing and non-first-parent bases`
- `bun test --test-name-pattern="^git-distance reports unavailable missing and non-first-parent bases$" ./tools/change-plan/tests/run.ts`

Contract:
- Git 距离的 measured 输入集合是可解析且位于当前 HEAD 第一父历史上的基线；其他基线返回 `base-unavailable` 及其定位证据。

Proves:
- 无法解析的 revision 返回 base-unavailable。
- 侧分支 revision 不在当前第一父历史时返回 base-unavailable，并保留基线与 HEAD。
