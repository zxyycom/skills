### Case GATE-RELEASE-FINAL-TIMING-001: release prepare 提前运行而 authorization 保持末端

Tests:
- `test:bce1370573c53be0a8e676f14b12f7556dc83b5ddefcf544d9f9b492a3a22fc0`

Tags:
- `repository-tooling`

Contract:
- release tag 的 `release:skill-prepare` 没有普通前置；`release:skill-version` 依赖全部普通 release-required Check 与 prepare；`pack:skills` 只依赖版本节点。

Proves:
- release DAG 保持 prepare 与普通 Check 并行、授权和打包位于末端。
