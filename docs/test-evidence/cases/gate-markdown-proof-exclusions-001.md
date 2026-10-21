### Case GATE-MARKDOWN-PROOF-EXCLUSIONS-001: Markdown 内容证明的原生排除

Tests:
- `test:2f0f0cf2b04cca359dd906317c6f04fa79e2092c529ef1cbc3c30da5f3275e8d`

Tags:
- `repository-tooling`

Contract:
- 内容证明使用与原生检查一致的当前源排除，且不得以文档排除裁掉公共配置闭包。

Proves:
- 历史材料、候选、上游副本及默认 build/vendor/.tmp 中 Markdown 不进入原生选集且修改后 lint 仍复用；原生配置实现变化则重新执行。
