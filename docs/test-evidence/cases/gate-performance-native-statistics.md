### Case GATE-PERFORMANCE-NATIVE-STATISTICS-001: 当前执行样本按 nearest-rank 计算 P90

Tests:
- `test:de12118876b9aa66bbdbed0f4c877d1ff09c9b3c89f30d535d501d15a5761f31`

Tags:
- `performance`
- `repository-tooling`

Contract:
- Check 性能统计使用当前实际执行样本的算术均值与 nearest-rank P90，输入顺序不改变结果。

Proves:
- 1、2、10 与 11 个已知样本分别给出独立期望的样本数、均值与 P90；乱序及 10/11 项分界能识别排序或 nearest-rank 位置错误。
