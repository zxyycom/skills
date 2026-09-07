### Case GATE-RELEASE-SNAPSHOT-TOCTOU-001: authorization 与打包使用 prepare 捕获的同一 snapshot

Tests:
- `test:8d089e29e87933c1ce96ffc3dedad799b80bebbdac6c25381d384b68437f97be`

Tags:
- `repository-tooling`

Contract:
- prepare 一次捕获 Git pending snapshot 并固定版本基线；authorization 与 `pack:skills` 只消费该内存 snapshot。

Proves:
- prepare 后 index 改为 v3 时，本次 zip 仍为 captured v2 内容且仅调用一次 pack。
