### Case GATE-MARKDOWN-PROOF-MISSING-001: Markdown 内容证明的旧路径归属

Tests:
- `test:2fd4ea980e3ac01f25b56cdf1d998233e48d2584b3c67675fa2e0707ff3afb2a`

Tags:
- `repository-tooling`

Contract:
- 已删除 tracked 根或额外 Markdown 的 missing 路径仍有合法规则归属，但不属于当前原生源集合。

Proves:
- 删除 tracked 文档后无 unknown、执行 lint、允许发布，未再变化时下一轮 lint 复用。
