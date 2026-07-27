### Case SKILL-PACKAGE-HASH-004: 接受初始版本为一的新 skill
Entry:
- `scripts/lib/skill-package-hash.test.ts > accepts a new skill at initial version one`
- `bun test --test-name-pattern="^accepts a new skill at initial version one$" ./scripts/lib/skill-package-hash.test.ts`
Contract:
- 基线不存在的新增 skill 以 `null` 表示，并允许从版本一开始。
Proves:
- gamma 在 HEAD 基线中为 `null`，以 staged v1 加入时不产生版本问题。
