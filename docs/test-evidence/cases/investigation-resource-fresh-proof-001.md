### Case INVESTIGATION-RESOURCE-FRESH-PROOF-001: 调查更名独立fresh保护资源身份和权限

Tests:
- `test:5ca2bc1c3d8d9a340ffc61a17c826c7c2dc2141db6e9aa57310eab3c4d1ab61f`

Tags:
- `investigation-report`

Contract:
- prepare到fresh间资源mode或inode变化应在写前拒绝，保留外部winner。

Proves:
- 分别chmod和同字节替换资源inode，源报告不改、目标不建、winner identity/mode保留。
