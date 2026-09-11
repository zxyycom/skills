### Case GATE-RELEASE-SNAPSHOT-TOCTOU-001: authorization 与打包使用 prepare 捕获的同一 snapshot

Tests:
- `test:03e395216e2c712c5293cad74dc936398f69b1c19e83e42ad70be3c3be4db316`

Tags:
- `repository-tooling`

Contract:
- prepare 一次捕获 Git pending snapshot 并固定版本基线；authorization 与 `pack:skills` 只消费该内存 snapshot。

Proves:
- prepare 后 index 改为 v3 时，本次 zip 仍为 captured v2 内容且仅调用一次 pack。
