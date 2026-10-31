### Case GATE-MARKDOWN-PROOF-MODE-001: Markdown 内容证明的权限身份

Tests:
- `test:c0cc96b6f0420546d82c61624cb1230a81e2341502eb32f5c2ceff2543f6fb8e`

Tags:
- `repository-tooling`

Contract:
- 内容证明必须绑定当前源权限 mode，而非只比较文件字节。

Proves:
- POSIX 下 ignored 根源从 0600 改为 0644 后重新执行 lint；Windows 显式跳过无同等语义的断言。
