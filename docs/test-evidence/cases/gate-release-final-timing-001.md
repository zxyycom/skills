### Case GATE-RELEASE-FINAL-TIMING-001: release prepare 提前运行而 authorization 保持末端

Tests:
- `test:ad2d863f0407b6a0acdc6119ee39c996ae35dd9bd02ab908f9a0fd4f7f95f6b0`

Tags:
- `repository-tooling`

Contract:
- release tag 的 `release:skill-prepare` 仅依赖环境前置；`release:skill-version` 依赖全部普通 release-required Check 与 prepare；`pack:skills` 依赖环境与版本节点。

Proves:
- release DAG 保持 prepare 与普通 Check 并行、授权和打包位于末端。
