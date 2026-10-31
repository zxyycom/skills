### Case INVESTIGATION-STAGE-EMPTY-RESOURCE-SYMLINK-001: 空所选资源树仍检查根与 owner

Tests:
- `test:0236fea322782f4a96d18bfc137c6f9cb1b38c001735ddca8eeeeb59d413b4f6`
- `test:9907b10a18d3559e413b6ff4f895aa9025b499f5de69afcc34befe8ed3a08350`

Tags:
- `investigation-report`

Contract:
- 无直接引用和无 HEAD 资源成员时仍须检查现存资源根和所选 owner 目录安全。

Proves:
- 在空成员集合下，真实 root 或 owner 目录符号链接仍使资源验证失败；不以资源引用或 HEAD 成员驱动安全检查。
