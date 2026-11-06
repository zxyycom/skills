### Case NATIVE-RECORD-CLI-INTERNAL-001: CLI 解析及事务诊断映射

Tests:
- `test:0aabf51bf99c26e341b82f3c8097bee1f178db8c16941a77e9f193469b279de3`
- `test:158ed63b52014f947fe05764dfbafaa7bf3581021b61cc446644ca71c765151b`
- `test:4cc0057d0940fc03d068e122fff3331d78a92ad8c1b5e387ab910a6a13309f0e`
- `test:4dbc333ed7a2e8958895162ba2f06292ac63e2900dda129b29a5c884f3b16395`
- `test:734eb2220659ac12cda7ac0909e39e1c9782c3d395b022e78d9508b3e9e67615`
- `test:7c73a623dfe0e83e953da2e018114d86233cc1f29218012fe53e3cb66be98f95`
- `test:b566f1566f893ec3a71a7fd95f9692fd1f6fbb9f15c4964df4ac5ac34168663e`
- `test:e259152bad12e9e58eb3b66449b8dda7d6d50993e44c65d0f98185484ae307a1`

Tags:
- `record-rust`

Contract:
- 入口须保留参数校验和底层阶段实际诊断，不虚构成功、回滚或所有权。

Proves:
- 入口局部输入与阶段失败验证选项、关系、锁竞争及事务消息和有序诊断字段传递。
