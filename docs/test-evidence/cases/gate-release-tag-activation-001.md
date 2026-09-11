### Case GATE-RELEASE-TAG-ACTIVATION-001: 原生 flag 选择保留未激活 release Check

Tests:
- `test:7d36da91f43c0b1b1778272f50f4a84ed43281a95d6e40f91eb7f1e5d2ee613a`

Tags:
- `repository-tooling`

Contract:
- 完整 Definition 中需要 `release` flag 的 Check 在无 tag 的 base Gate 仍保留；Vibe 原生 flag selection 必须先于 Check preflight，未激活项不执行、以 `flag-condition-not-matched` not-applicable、`not run` 和 null duration 结算，effective aggregate 只纳入本次有效 Check。

Proves:
- 一个 base 与一个 release Check 的真实 Vibe Run 以 effective aggregate 通过，snapshot 仍包含两个 Check；release Check 的 preflight 与 execution 调用次数均为零，结果是原生 flag-condition not-applicable 且 duration 为 null。
