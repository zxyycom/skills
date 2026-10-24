### Case RECORD-READER-FIRST-FAILURE-001: 大集合发现不以晚到探测掩盖首次读取失败

Tests:
- `test:0ceadd8dc77d32a5eb5bf5b9a8268fd652bca6fca91467f1c49fa5841f761127`

Tags:
- `record-operations`

Contract:
- 大集合worker已拒绝的安全读取必须原样失败，不再执行可能覆盖该错误的后续regular探测；小集合先执行 regular 探测，再读取来源。

Proves:
- 1000项以上真实集合的首条symlink来源由worker拒绝，故意会抛另一权限错误的后续lstat没有被调用，symlink现场未被改变。
