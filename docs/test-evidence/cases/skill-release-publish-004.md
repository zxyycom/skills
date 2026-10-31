### Case SKILL-RELEASE-PUBLISH-004: 发布入口在副作用前拒绝不完整资产

Tests:
- `test:83f905d00e0c7112174e472d04e8d394cd3ac327cf1935db29bb880a95972684`

Tags:
- `repository-tooling`

Contract:
- 发布输入必须至少包含一个普通 zip 文件和一个普通文件形式的 release manifest；本地资产无效时不得进入 Git 或 GitHub 命令边界。

Proves:
- 只有 manifest 而没有 skill zip 时，CLI 返回退出状态 `1`，并向错误通道给出可行动诊断。
- 资产校验失败时没有执行或读取任何外部命令。
