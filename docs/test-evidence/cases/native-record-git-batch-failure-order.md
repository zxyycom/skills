### Case NATIVE-RECORD-GIT-BATCH-FAILURE-001: 选中 pending 的首个错误

Tests:
- `test:4cf732ca961d922f4ecc921e26f6fc289376c6405ac71ddc33308f0e4ffca839`

Tags:
- `record-rust`

Contract:
- 选中 pending 时不得以后续冲突覆盖更早选中对象的读取失败。

Proves:
- 私有 Git index 中先缺失对象、后存在多 stage 冲突；恢复对象前后分别观察读取失败与冲突诊断。
