### Case GATE-RELEASE-VERSION-FAILURE-001: prepare 或版本失败阻断打包

Entry:
- `scripts/vibe-check.test.ts > release preparation or version failure blocks packaging`
- `bun test --test-name-pattern="^release preparation or version failure blocks packaging$" ./scripts/vibe-check.test.ts`

Contract:
- prepare unavailable 或 prepare 已分析出的版本问题都会使授权无法 passed，且 `pack:skills` 不得通过或写入制品。

Proves:
- 版本未提升和注入的 prepare 失败均阻断打包。
