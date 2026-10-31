### Case GATE-MARKDOWN-PROOF-ACQUISITION-001: Markdown 内容证明的磁盘全集

Tests:
- `test:c88360dbec16a10d841a65592176af32d80e48aaa9c5f5821fe0ebf0600d9247`

Tags:
- `repository-tooling`

Contract:
- 内容证明必须联合原生选集，覆盖根目录、额外目录、Git ignored 与大小写 Markdown 后缀，并接受这些当前源的合法归属。

Proves:
- 各类新源进入同一快照且不落 unknown；新增时执行 lint，发布后相同输入可复用。
