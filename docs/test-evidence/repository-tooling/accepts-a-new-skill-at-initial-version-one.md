### Case SKILL-PACKAGE-HASH-004: 接受初始版本为一的新 skill
Entry:
- `scripts/lib/skill-package-hash.test.ts > accepts a new skill at initial version one`
- `bun test --test-name-pattern="^accepts a new skill at initial version one$" ./scripts/lib/skill-package-hash.test.ts`
Contract:
- 基线不存在的新增 skill 以 `null` 表示，并允许从版本一开始。
Proves:
- 注入的基线仓储中不存在 gamma 时其基线为 `null`，当前 snapshot 以 v1 加入不会产生版本问题。
