### Case SKILL-PACKAGE-HASH-003: 要求变化 skill 独立提升版本
Entry:
- `scripts/lib/skill-package-hash.test.ts > requires changed skills to increase independent versions`
- `bun test --test-name-pattern="^requires changed skills to increase independent versions$" ./scripts/lib/skill-package-hash.test.ts`
Contract:
- 包内容相对基线变化时，只要求对应 skill 的版本高于自身基线。
Proves:
- alpha 内容变化且仍为 v3 时产生问题，staged 提升到 v4 后问题消失。
