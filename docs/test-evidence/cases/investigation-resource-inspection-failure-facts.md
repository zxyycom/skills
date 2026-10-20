### Case INVESTIGATION-RESOURCE-INSPECTION-FAILURE-FACTS-001: 资源读取故障与普通验证问题分别承接

Tests:
- `test:1a49b36c6d218ebd2af1a179e0ea2c2d4b3a0aedec2e83b68701ac167fefdcf2`
- `test:38a2b1ca6ad49b958d3499b7f9ff861526a1be012a0e47565f9ede23984e91fd`
- `test:48cc1021797bb06f56d2a81bf93d29d1bd2235b930de885c38cb19f7f1d74b2a`
- `test:55d96e0646e047ca62fc292232828c5ddef6a3cbd0af951680e3e5ae5c2c576e`
- `test:5721afb25a408ed7d26a017314694b62b13438046d985414a928abd2feb025af`
- `test:6bb262f36c3ce13b4310812b7ce77cc20662b18f78d7056222ce5415104bb4e5`
- `test:a1adfd783cd15f174d80dd6a95da6eb87eb771131fd2fa242b8f3a70de8e2369`
- `test:b0c4a214056c3aafcd0606272ec8ef7ce3b9497b35bfce7a9c920f13aa028174`
- `test:c239bf62e13ed7d210d5e5e13aeb18fc315879311d9fd38ce8da1c5022d8a7c4`
- `test:facfa841f2258361a2ddabb3eae1cf3f9f958113092c9a025de7638fc94abd48`

Tags:
- `investigation-report`

Contract:
- 资源文件系统边界保留真实读取失败的净化category、operation和目标；写前复核失败不发布，默认候选与查询验证仍消费原issues，普通路径安全问题不附会系统类别。

Proves:
- 成功读取后的新资源验证中，root inspection/resolution/enumeration、owner/intermediate enumeration、file inspection 和 terminal open 的 EACCES 保留 access-denied、实际目标与操作；净化 diagnostic 不含私密文本、凭据或控制字符。
- 默认 issues 与详细检查 errors 一致；terminal open 失败仍保留 regular-file 验证消息，普通 symlink 问题不附会 filesystem failure 类别。
- 真实 domain stage 的同进程 CLI 代表将未知 errno 的 terminal open 故障报告为 source-drift、unknown 与相对目标，给出文件系统恢复动作；stdout 为空，Git index 不变且不泄露私密文本。
