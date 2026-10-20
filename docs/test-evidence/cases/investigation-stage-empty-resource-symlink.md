### Case INVESTIGATION-STAGE-EMPTY-RESOURCE-SYMLINK-001: 空所选资源树仍检查根与 owner

Tests:
- `test:5175c43b7d6b72069d61c45a3173bb44bdbc69357e2bc21e365c9d6614a22cd8`
- `test:6bbbd3c47bd5fece210c3468c7fb5d0dc2b79d25e6142b8e6c4d6e424a85cd80`

Tags:
- `investigation-report`

Contract:
- 无直接引用和无 HEAD 资源成员时仍须检查现存资源根和所选 owner 目录安全。

Proves:
- 在空成员集合下，真实 root 或 owner 目录符号链接仍使资源验证失败；不以资源引用或 HEAD 成员驱动安全检查。
