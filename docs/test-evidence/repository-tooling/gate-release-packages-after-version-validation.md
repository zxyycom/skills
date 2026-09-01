### Case GATE-RELEASE-PACK-SUCCESS-001: 版本校验通过后恰好打包一次

Entry:
- `scripts/vibe-check.test.ts > release terminal Check packages exactly once after version validation passes`
- `bun test --test-name-pattern="^release terminal Check packages exactly once after version validation passes$" ./scripts/vibe-check.test.ts`

Contract:
- `pack:skills` 只依赖 `release:skill-version`，只有版本节点通过后才可调用实际打包脚本；成功的 full invocation 恰好调用一次。

Proves:
- 成功时 release DAG 顺序为一次 `hash:skills`、一次 `pack:skills`，aggregate passed。
- version 结果保留基线；隔离 `dist/` 中存在由唯一打包调用写入的 fixture 制品。
