### Case INVESTIGATION-STAGE-EMPTY-RESOURCE-SYMLINK-001: 空所选资源树仍检查根与 owner

Tests:
- `test:91a237785d3f1d50f204141764b7fec434fe00d43a686eb5af51428acbcada93`
- `test:fd08882e14a6ab7496250792b18f87736fd46cd053f49cd1828986b9969d5b3d`

Tags:
- `investigation-report`

Contract:
- 无直接引用和无 HEAD 资源成员时仍须检查现存资源根和所选 owner 目录安全。

Proves:
- 空 root 或 owner 目录符号链接使 domain 失败且 Git index 原始字节不变。
