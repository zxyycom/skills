### Case RECORD-READER-BACKPRESSURE-001: 内部批次背压不截断正文

Tests:
- `test:bd9d2301bba5d30b72af69a423d6c15ccfc996b9a0fa70356b11c306cb6cd78d`

Tags:
- `record-operations`

Contract:
- 内部chunk只限制在途批量，不构成正文预算；消费完成后才继续下一chunk。

Proves:
- 大于内部字节目标的单文件完整返回，首项消费后修改的后续来源均以新字节读取。
