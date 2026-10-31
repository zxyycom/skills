### Case GATE-MARKDOWN-PROOF-EXCLUSIONS-001: Markdown 内容证明的原生排除

Tests:
- `test:5bba4c7a3b80169186e8b9ea6cc229c056f5b630fa0556ba83f605e05531775c`

Tags:
- `repository-tooling`

Contract:
- 内容证明使用与原生检查一致的当前源排除，且不得以文档排除裁掉公共配置闭包。

Proves:
- 历史材料、候选、上游副本及默认 build/vendor/.tmp 中 Markdown 不进入原生选集且修改后 lint 仍复用；原生配置实现变化则重新执行。
