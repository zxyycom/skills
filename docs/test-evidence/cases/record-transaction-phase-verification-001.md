### Case RECORD-TRANSACTION-PHASE-VERIFICATION-001: 同阶段重叠保护只复用完整相同事实

Tests:
- `test:a2bb34494a5bf23a048b9747aeec8a22a2ab2e16b9a5699deba600be7b52d34a`
- `test:b0035362fb1c178c15f2cec8e832273832b6cbc101802bfae5f556ac901d4ff1`
- `test:ebd332819c829a73c907570c151eb532b426aafe4a8ced579d091451457ed1f6`

Tags:
- `record-operations`

Contract:
- 共同事务的写前文件保护 verifyPlan 与写后文件保护 verifyWritten 分别取得本阶段实际 snapshot；仅同 root、绝对目标及完整预期事实可在本阶段重叠保护间复用。实际写入的 readback、领域 fresh/postverify 与恢复 CAS 保持各自义务。

Proves:
- unchanged write 与重叠 guards 在 verifyPlan、verifyWritten 各打开一次；路径规范化后相同、完整事实相同但对象不同的预期 snapshot 也可复用。事务成功且 changed 为 false，仍完成两阶段实际读取；计数范围为共同事务的文件保护阶段。
- 不同 namespace 或预期 mode、inode、bytes、父链均不能借用先前证明；调用者修改可变 expected bytes 也不能改变已经实际取得的证明，错误预期必须失败。
- 写前保护通过后，在索引 writer 内分别注入后来 bytes、mode 或同 bytes/mode 的新 inode，写后保护均独立拒绝。结果为 error、committed 为 true、verification 为 failed-or-unknown，后来来源的内容、mode 和替换 inode 保持，不自动恢复覆盖。
