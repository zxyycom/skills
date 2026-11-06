### Case NATIVE-RECORD-TXN-RESTORE-001: 重命名和资源删除的条件恢复

Tests:
- `test:045ad0dc30cba6b9893744850c061cadf42d349ee66955f6e0347be9411a6415`
- `test:23e97198f24857de57d9a8c1ce2de0d5a3fe105b45a2f8c9ebf9228ca18ac47e`
- `test:38a53e5c3fb0020e717ce49e7ea2fc7ece92bd200c54bc27a17363e8663a21e1`
- `test:56d9f437da44c8289c33c7bfdaf43ef213596aea5fc0ea336e9170b65aa25d41`
- `test:6609b6ee35634d24ed6a9a889a27e323d4345d6b060b02860a82ca98ee19247e`
- `test:6923c867a55fb7fd3baca4072e88263b2346a1e57e73f960d4712377f70ca5e0`
- `test:6ea7408c39169c8c03652d088f97728bc966b51b0fad0d52de971b83ae4fb0e4`
- `test:d424328b15c184a158fe8002028bf04c7a3179e722ef2c6ef76974909018e294`
- `test:edae6844a242fbb1b6c89dcb1dc71c60af91af4ac883d8a2f76402d0bfd318b1`
- `test:f48daab5e627e6b2ada356d091770a04564ed793c2368be6e374a04fe5991d0a`

Tags:
- `record-rust`

Contract:
- 恢复只能作用于仍有事务所有权的对象，不能覆盖后来编辑。

Proves:
- 局部文件事务验证旧名恢复、新名清理、资源删除和后续编辑保留。
