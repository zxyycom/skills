### Case INVESTIGATION-RESOURCE-SCOPE-001: scoped resource checks do not claim global unreferenced resource proof

Tests:
- `test:daca6a5451eb7ef2d2c915f09737d6e636afc495015fc4827088c1ce355f1343`

Tags:
- `investigation-report`

Contract:
- scoped resource validation 不声明完成全局未引用资源与索引证明。

Proves:
- 按 ID 校验时 indexChecked 为 false，忽略无关 owner 的未引用资源；同一 fixture 的完整校验会报告该资源。
