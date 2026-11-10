### Case NATIVE-RECORD-SOURCE-SHARED-DAG-001: 共享引用图不发生指数展开

Tests:
- `test:0710d929dad0efe87c0d79f2433bf2c0c126d38447bf411c9f2c6ece4edcb88b`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 合法来源图中的重复引用不应作为树反复展开；一个实际来源只出现一次。

Proves:
- 36 个 key、每层重复引用前层两次的图在真实 help 子进程中成功，显示 n35 并只列一个展开来源；没有索引或报告 fixture。
- 子进程 stdout/stderr 由私有临时文件承接；30 秒截止负责阻断无限或指数执行，不作为性能指标断言。
