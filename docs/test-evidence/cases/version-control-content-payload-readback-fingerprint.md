### Case VERSION-CONTROL-CONTENT-PAYLOAD-READBACK-001: 写后校验更新与保留所选实际字节

Tests:
- `test:abaafa1eb5e10f62b8cc833d93bc9efeb581db593886b77094e00d5a704b50d2`
- `test:e42071eeae3aa23bf78c28fa36010778e1262dc46695a7a0ca77398c987313e3`

Tags:
- `version-control`

Contract:
- content-paths写后同时核对完整entries目标、更新payload字节和仍在所选边界内的保留payload指纹。

Proves:
- 写后改写合法blob实际字节但保持OID，无论属于更新目标还是保留所选对象，都拒绝发布并恢复原index字节。
