### Case RECORD-NATIVE-RELEASE-RECOVERY-001: 不完整发布恢复及原字节校验

Tests:
- `test:de7a24c298e038eef3ac69a0db89cd521d34599f68044f19e7ffaa60bfaafb8b`

Tags:
- `repository-tooling`

Contract:
- 恢复包在固定发布身份、来源及配方成立时承接中断发布；已发布成员与恢复内容必须一致。

Proves:
- 私有内存 ZIP 在运行时未上传、部分上传及全部上传时可恢复，已有制品冲突、损坏恢复包及同长度损坏的独立构建证明均被拒绝。
