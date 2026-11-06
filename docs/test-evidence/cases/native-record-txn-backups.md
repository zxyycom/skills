### Case NATIVE-RECORD-TXN-BACKUPS-001: 事务备份与新 namespace 所有权

Tests:
- `test:8754973abdf21d5897323c509fa0e27d341f931980fc1df1d0a460c017f49aee`
- `test:9b011533213b26bf53e20bc25832c29caee4510d00e83536b8b13411d43aae69`
- `test:aea1e0b89bcf18986f3d038e43c4fcf0769e7f7212f1be9537b75248acecfbfd`
- `test:c752f707e3826e7059f1e4abccc8af944d4e876b7a3b4a0184a086c2221607cb`
- `test:c7928d08884437cba2d243a12138ea572e7fb6d5a4c33f2a53edc4d381aea9d7`

Tags:
- `record-rust`

Contract:
- 备份清理及新建 namespace 只能处理已证明属于事务的对象。

Proves:
- 注入竞争者及备份漂移，回读实际内容并验证未知所有权不被删除。
