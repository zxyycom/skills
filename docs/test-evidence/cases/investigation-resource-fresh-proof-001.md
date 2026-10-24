### Case INVESTIGATION-RESOURCE-FRESH-PROOF-001: 调查更名独立fresh保护资源身份和权限

Tests:
- `test:7b2027cda772f6d68af96bcb52978bb5d9b2633b9eed0c21a71fa5ef38d106eb`

Tags:
- `investigation-report`

Contract:
- prepare到fresh间资源mode或inode变化应在写前拒绝，保留外部winner。

Proves:
- 分别chmod和同字节替换资源inode，源报告不改、目标不建、winner identity/mode保留。
