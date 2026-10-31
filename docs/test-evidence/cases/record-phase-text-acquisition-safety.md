### Case RECORD-PHASE-TEXT-SAFETY-001: 当前验收阶段采集文本保持根与可变事实隔离

Tests:
- `test:b60b6441bb251a1032debd9947c1b780d85403d83b4af532a3cc08ec8d361f60`

Tags:
- `record-operations`

Contract:
- 当前 phase 的来源采集必须真实读取同 root 的安全普通文件并严格解码 UTF-8；交给领域的 bytes 与父身份对象不能改变私有实际观察，其他阶段必须重新观察。

Proves:
- 错误 root 零采集失败；修改领域副本 bytes 与父身份后，原 expected 仍以一次真实打开通过，修改后的 expected 被拒绝；非法 UTF-8、symlink、缺失有可区分失败，新 phase 拒绝后来字节变化。
