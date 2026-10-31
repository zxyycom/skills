### Case GATE-MARKDOWN-PROOF-RENAME-001: Markdown 内容证明的重命名与后缀

Tests:
- `test:ba838b756b7c4db91f5f934d14b63ac77e79f7d8d58f21b88b4bb58efe7bedbd`

Tags:
- `repository-tooling`

Contract:
- ignored 源的路径重命名和从 Markdown 变为非 Markdown 后缀都改变精确源集合。

Proves:
- Git 不保留旧路径时，ignored 源改名为另一 Markdown 或 txt 都触发 lint 并可在新输入下发布。
