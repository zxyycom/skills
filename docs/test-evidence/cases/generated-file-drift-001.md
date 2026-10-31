### Case GENERATED-FILE-DRIFT-001: 生成文件检查识别真实漂移

Tests:
- `test:13dfb56d5ab85438e969df5a76ca65e932b9567ffbc18a949849d121a8ac97f2`

Tags:
- `repository-tooling`

Contract:
- 生成文件检查应忽略纯换行差异并报告实质内容漂移。

Proves:
- 等价换行通过检查，内容变化返回漂移诊断。
