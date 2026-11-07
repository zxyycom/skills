### Case NATIVE-RECORD-CLI-INTERNAL-001: CLI 解析及事务诊断映射

Tests:
- `test:0acf66749aca8c1ed1586d5b030a02ce2ec903b30c1d67dd8c1ed588cc8f384f`
- `test:158ed63b52014f947fe05764dfbafaa7bf3581021b61cc446644ca71c765151b`
- `test:6489f6913dda08f81c88c1db2ecdec6658ce01d4df83232e223ab5beb4e66534`
- `test:84fb4c401eda13363c61976627f7e8d5fad9e98a4cca1bb1aa28b118baabc22a`
- `test:b566f1566f893ec3a71a7fd95f9692fd1f6fbb9f15c4964df4ac5ac34168663e`

Tags:
- `record-rust`

Contract:
- 入口须正确解析参数并保留底层诊断。

Proves:
- 局部输入验证选项、关系参数与有序诊断字段传递。
