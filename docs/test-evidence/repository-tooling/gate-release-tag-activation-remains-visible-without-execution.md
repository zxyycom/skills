### Case GATE-RELEASE-TAG-ACTIVATION-001: 未激活 release Check 可见但不执行

Entry:
- `scripts/vibe-check.test.ts > inactive release Checks remain visible without starting their original preflight or execution`
- `bun test --test-name-pattern="^inactive release Checks remain visible without starting their original preflight or execution$" ./scripts/vibe-check.test.ts`

Contract:
- 完整 Definition 中需要 `release` tag 的 Check 在无 tag 的 base Gate 也必须显示；activation preflight 必须先于原 preflight，且未激活项不执行、以稳定 `gate-tag-not-enabled` unavailable reason、`not run`、null duration 与 `Pass --tag release` 提示结算，不进入 base aggregate。

Proves:
- 一个 base 与一个 release Check 的真实 Vibe Run 在只选择 base aggregate 时通过，snapshot 仍包含两个 Check；release Check 的原 preflight 与 execution 调用次数均为零，结果是 `gate-tag-not-enabled` unavailable 且 duration 为 null。
