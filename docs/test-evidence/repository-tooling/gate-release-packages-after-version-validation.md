### Case GATE-RELEASE-PACK-SUCCESS-001: 版本校验通过后恰好打包一次

Entry:
- `scripts/vibe-check.test.ts > release terminal Check packages exactly once after version validation passes`
- `bun test --test-name-pattern="^release terminal Check packages exactly once after version validation passes$" ./scripts/vibe-check.test.ts`

Contract:
- release 终结 Check 只有在版本校验通过后才可调用 `pack:skills`；成功的 full invocation 恰好调用一次。

Proves:
- 成功时终结阶段顺序为一次 `hash:skills`、一次 `pack:skills`，aggregate passed。
- 成功终态数据保留基线；隔离 `dist/` 中存在由唯一打包调用写入的 fixture 制品。
