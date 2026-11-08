### Case NATIVE-PUBLISHER-RECOVERY-001: 原生发布恢复资产先于运行时

Tests:
- `test:fd7c5d450b74aa25d16a1ac480252065791985f59809566037c0a146db730476`

Tags:
- `repository-tooling`

Contract:
- 滚动发布必须先上传并回读本轮不可变恢复包，再上传独立运行时资产；中断后只能以已验证原字节恢复，同名冲突不得覆盖。

Proves:
- 隔离远端替身记录恢复包首先上传并回读，在部分运行时上传后中断；下载恢复包重建四个运行时，冲突被拒绝，恢复一致内容后重入成功并发布 manifest。
- 测试不访问真实 GitHub，不证明真实发布或跨平台运行。
