### Case GATE-MARKDOWN-PROOF-ROUTING-001: Markdown 内容证明的路由

Tests:
- `test:84555fa6a82b58ee090ae8f73fb00d27587f31ddc580b5af2b5c84d7d933aa08`

Tags:
- `repository-tooling`

Contract:
- 稳定 Markdown 与规则输入可复用内容检查，不因无关业务 TypeScript 字节变化执行。

Proves:
- 相同成功输入和普通业务 TS 改动保持 markdown-lint reuse；Markdown 正文变化激活 markdown-content 并执行 lint。
