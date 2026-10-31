### Case GATE-CATALOG-LEAF-OWNER-001: catalog 保留 leaf 身份而不消费无关 helper

Tests:
- `test:4b86c593833386ee6b3cd158474f3350ceb81dd3a459af715c8772a5da6d417c`

Tags:
- `repository-tooling`

Contract:
- 测试 catalog 的实际 wrapper/run/leaf 输入不能漏，未读 helper 内容不扩大它的证明域。

Proves:
- 未读 helper/fixture 内容变化可复用 catalog；wrapper/run/leaf 变化及真实 leaf 删除使其重跑。
