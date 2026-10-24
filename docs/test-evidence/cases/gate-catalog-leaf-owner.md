### Case GATE-CATALOG-LEAF-OWNER-001: catalog 保留 leaf 身份而不消费无关 helper

Tests:
- `test:cdde777d6a51183f67281f703752ce50ba81bc3cab2947d7e4413a30572f779d`

Tags:
- `repository-tooling`

Contract:
- 测试 catalog 的实际 wrapper/run/leaf 输入不能漏，未读 helper 内容不扩大它的证明域。

Proves:
- 未读 helper/fixture 内容变化可复用 catalog；wrapper/run/leaf 变化及真实 leaf 删除使其重跑。
