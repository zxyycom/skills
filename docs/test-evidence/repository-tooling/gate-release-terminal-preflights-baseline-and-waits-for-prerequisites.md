### Case GATE-RELEASE-FINAL-TIMING-001: release prepare 提前运行而 authorization 保持末端

Entry:
- `scripts/vibe-check.test.ts > release prepare runs before terminal authorization and package`
- `bun test --test-name-pattern="^release prepare runs before terminal authorization and package$" ./scripts/vibe-check.test.ts`

Contract:
- full 的 `release:skill-prepare` 没有普通前置；`release:skill-version` 依赖全部普通 release-required Check 与 prepare；`pack:skills` 只依赖版本节点。

Proves:
- release DAG 保持 prepare 与普通 Check 并行、授权和打包位于末端。
