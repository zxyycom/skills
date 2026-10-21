### Case GATE-MARKDOWN-PROOF-MODE-001: Markdown 内容证明的权限身份

Tests:
- `test:3043e2681c4840260f091ee6cc2e33c1b0a07c305bebc0700467827bd9f7d50e`

Tags:
- `repository-tooling`

Contract:
- 内容证明必须绑定当前源权限 mode，而非只比较文件字节。

Proves:
- POSIX 下 ignored 根源从 0600 改为 0644 后重新执行 lint；Windows 显式跳过无同等语义的断言。
