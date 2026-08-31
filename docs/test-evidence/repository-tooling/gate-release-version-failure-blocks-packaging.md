### Case GATE-RELEASE-VERSION-FAILURE-001: 版本校验失败阻断打包

Entry:
- `scripts/vibe-check.test.ts > release version validation failure blocks package execution`
- `bun test --test-name-pattern="^release version validation failure blocks package execution$" ./scripts/vibe-check.test.ts`

Contract:
- release 终结 Check 在前置通过后必须先校验 skill 版本；该校验 failed 时 final Check failed，且本次零调用 `pack:skills`。

Proves:
- 注入的 `hash:skills` 非零退出使 `pack:skills` Check 结算为携带基线与版本脚本终态的 failed。
- 版本校验恰好运行一次，打包没有被调用。
