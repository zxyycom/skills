### Case DR-INDEX-PAYLOAD-PENDING-RECHECK-001: index独立复核全域pending身份

Tests:
- `test:4a36fb057611a09a38165e36b4723555c775105bf3c4cc944585304e03c0a47b`
- `test:a3b23bc06eb4cc7fadb6f1ca82fe8522bc58b2e13d9750278f937c2db18bd930`
- `test:b168c02bd9a299e202d80fefbc5cada26321348f1782cbdbe5bb8c18a8f94349`
- `test:d4c8ff3e02c8f507ac0dfcbec26af36cf58d0f2cf9c0c6f82ff72bc0e0b61da5`

Tags:
- `decision-records`

Contract:
- index的content-paths策略不取消准备与写前之间完整pending路径、mode及OID身份保护。

Proves:
- 在独立写前读取W时改变未选OID、mode、成员增加或staged删除，stage拒绝且保留并发Git index现场。
