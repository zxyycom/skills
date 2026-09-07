### Case GENERATED-FILE-DRIFT-001: 生成文件检查识别真实漂移

Tests:
- `test:228837c4aeb91d1788045125a81a4607d0d3e1f6d5d5af1e573c0cbaffd02e27`

Tags:
- `repository-tooling`

Contract:
- 生成文件检查应忽略纯换行差异并报告实质内容漂移。

Proves:
- 等价换行通过检查，内容变化返回漂移诊断。
