### Case INVESTIGATION-RESOURCE-INSPECTION-FAILURE-FACTS-001: 资源读取故障与普通验证问题分别承接

Tests:
- `test:02c90455cacd702ff16686e26b3e8b02aeea3e21c20a6c2741781045b7e98299`
- `test:05e75e9f612bbb930d74bb135d3e30a8a9fa749feb68f8d7cae4f6541a35e93f`
- `test:28dc4873bf9dc26cb503a6d41b9dc207b487bcc0fff6b4bee2e9b5f12b9389ff`
- `test:4526c4b3b6b496ba401a4cab1018c09980c259b1e0943dfb790101298d525ab5`
- `test:556cf10e71df9c2172c7a6acc607d5afe77e45964030650b877d340eed8fbaf0`
- `test:8b0fe474d54cfe295319a98b288d2cbf4dd900c8ff3d9ec4e8ef2bc4a5bfb4fa`
- `test:b6957959d7320d05c57d0cba228ac3d9db304f9b4f0361e83d372cd7ca82dda1`
- `test:dc21053491cd8650384f420bec4dc63b5b89be3019e459fdec733bb7fba5c39a`
- `test:f83cec4ea0ed587cecb9e5e9c853d14d582b41d7eec449aa40fcdf41c47ef03f`
- `test:f85672d9e43de13571b10ce7a121903a8605a8362d6ed0e15aa33a22eabf7bdc`

Tags:
- `investigation-report`

Contract:
- 资源文件系统边界保留真实读取失败的净化category、operation和目标；写前复核失败不发布，默认候选与查询验证仍消费原issues，普通路径安全问题不附会系统类别。

Proves:
- 成功读取后的新资源验证中，root inspection/resolution/enumeration、owner/intermediate enumeration、file inspection 和 terminal open 的 EACCES 保留 access-denied、实际目标与操作；净化 diagnostic 不含私密文本、凭据或控制字符。
- 默认 issues 与详细检查 errors 一致；terminal open 失败仍保留 regular-file 验证消息，普通 symlink 问题不附会 filesystem failure 类别。
- 真实 domain stage 的同进程 CLI 代表将未知 errno 的 terminal open 故障报告为 source-drift、unknown 与相对目标，给出文件系统恢复动作；stdout 为空，Git index 不变且不泄露私密文本。
