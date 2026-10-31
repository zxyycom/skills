### Case GATE-MARKDOWN-PROOF-MISSING-001: Markdown 内容证明的旧路径归属

Tests:
- `test:69a04e86ba830eb55231fa1e529c68947f181447c0e1b98fb36a07f22d67e09c`

Tags:
- `repository-tooling`

Contract:
- 已删除 tracked 根或额外 Markdown 的 missing 路径仍有合法规则归属，但不属于当前原生源集合。

Proves:
- 删除 tracked 文档后无 unknown、执行 lint、允许发布，未再变化时下一轮 lint 复用。
