### Case NATIVE-MISSING-MEMBER-REPAIR-001: 已证明成员的缺失修复

Tests:
- `test:4a854405c25f1f3259f09d3479ababad20998a8c0e16c98533748942fa9ad92a`

Tags:
- `repository-tooling`

Contract:
- 完整的已验证安装证据与 receipt 共同证明归属时，仅可显式补充缺失受管成员；已有内容冲突不得覆盖，失败只撤销可证明本轮创建的成员。

Proves:
- 缺二进制被识别并补回；现有篡改、缺失证据及确认后出现的竞争文件被拒绝；验证失败撤销本轮文件与空目录。此节点不证明 Windows 文件占用行为或真实业务执行。
