### Case GRAPH-TRACE-ITERATOR-001: 缓存命中前核对继承迭代语义

Tests:
- `test:01e6ed36bffdfaa4137f2754a31a79d2adb91dff321f6de0d9a71917352b58f0`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 先前可复用的冻结数组在继承的迭代消费方式改变后，仍应按当前快照处理。

Proves:
- 首次完整接纳后替换继承 iterator，后续 b 仍被接纳；fixture 在 finally 恢复原 iterator。
