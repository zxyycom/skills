### Case GATE-MARKDOWN-PROOF-CONFIGURATION-001: Markdown 内容证明的配置闭包

Tests:
- `test:cf4d28b796814ada098f5b36310e91c7c40d1a0e93e048842d2ff63630913aff`

Tags:
- `repository-tooling`

Contract:
- 源 selection、规则和限制的实现、原生声明配置以及 manifest/lock 都属于内容证明输入。

Proves:
- 修改 selection owner、native 配置、contracts、package.json 或 pnpm-lock.yaml 时 markdown-lint 重新执行。
