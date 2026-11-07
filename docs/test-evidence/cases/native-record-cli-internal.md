### Case NATIVE-RECORD-CLI-INTERNAL-001: CLI 解析及事务诊断映射

Tests:
- `test:158ed63b52014f947fe05764dfbafaa7bf3581021b61cc446644ca71c765151b`
- `test:4cc0057d0940fc03d068e122fff3331d78a92ad8c1b5e387ab910a6a13309f0e`
- `test:4dbc333ed7a2e8958895162ba2f06292ac63e2900dda129b29a5c884f3b16395`
- `test:b566f1566f893ec3a71a7fd95f9692fd1f6fbb9f15c4964df4ac5ac34168663e`
- `test:e259152bad12e9e58eb3b66449b8dda7d6d50993e44c65d0f98185484ae307a1`

Tags:
- `record-rust`

Contract:
- 入口须正确解析参数并保留底层诊断。

Proves:
- 局部输入验证选项、关系参数与有序诊断字段传递。
