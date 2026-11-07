### Case NATIVE-RECORD-GIT-LOCK-FAILURE-001: Git 锁占用的未知结果

Tests:
- `test:a62b0c4710ae9608236e640632c4f197bf2dce141e2a82ce17c6782848b295a8`

Tags:
- `record-rust`

Contract:
- Git 锁不可用时不得删除他人锁或把结果伪称成功。

Proves:
- 真实 Git 的占用锁验证失败、未知结果和原锁保留。
