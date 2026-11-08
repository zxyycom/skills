### Case NATIVE-CI-RELEASE-REUSE-OUTPUT-001: 冷发布复用目录

Tests:
- `test:c09098899a20515db93765492260f1c21299357e9804ea71232bf3bb9a6d3e97`

Tags:
- `repository-tooling`

Contract:
- 干净发布工作区可创建复用输出的父目录；已有同名输出不得覆盖或清空。

Proves:
- 实际文件系统测试缺少 dist 时创建目标，并验证重入拒绝及既有 sentinel 保持；不证明远端制品身份。
