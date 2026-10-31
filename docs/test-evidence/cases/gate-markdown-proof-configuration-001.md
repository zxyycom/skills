### Case GATE-MARKDOWN-PROOF-CONFIGURATION-001: Markdown 内容证明的配置闭包

Tests:
- `test:fc433c2bf40c2d9437fa398696e02b433461418a9f81e15c9c1d263dc4c67af5`

Tags:
- `repository-tooling`

Contract:
- 源 selection、规则和限制的实现、原生声明配置以及 manifest/lock 都属于内容证明输入。

Proves:
- 修改 selection owner、native 配置、contracts、package.json 或 pnpm-lock.yaml 时 markdown-lint 重新执行。
