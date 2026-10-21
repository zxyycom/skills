### Case GATE-MARKDOWN-PROOF-ACQUISITION-001: Markdown 内容证明的磁盘全集

Tests:
- `test:13bfd791f3f904e0ee61bc0b47cbc20007f95664dacd6c49016853ba9f67c293`

Tags:
- `repository-tooling`

Contract:
- 内容证明必须联合原生选集，覆盖根目录、额外目录、Git ignored 与大小写 Markdown 后缀，并接受这些当前源的合法归属。

Proves:
- 各类新源进入同一快照且不落 unknown；新增时执行 lint，发布后相同输入可复用。
