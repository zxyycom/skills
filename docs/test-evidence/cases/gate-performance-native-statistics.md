### Case GATE-PERFORMANCE-NATIVE-STATISTICS-001: 当前执行样本按 nearest-rank 计算 P90

Tests:
- `test:450d53571d1ba9229deda46cf4a1f6b6620a461d31319688fdadf08fcd71b786`

Tags:
- `performance`
- `repository-tooling`

Contract:
- Check 性能统计使用当前实际执行样本的算术均值与 nearest-rank P90，输入顺序不改变结果。

Proves:
- 1、2、10 与 11 个已知样本分别给出独立期望的样本数、均值与 P90；乱序及 10/11 项分界能识别排序或 nearest-rank 位置错误。
