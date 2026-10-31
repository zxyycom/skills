### Case VERSION-CONTROL-CONTENT-PAYLOAD-READBACK-001: 写后校验更新与保留所选实际字节

Tests:
- `test:1868c792477d6fdb5ed52be6365cfd54d09e17714c20f74953174aa46b24d788`
- `test:9b15596c0cb10ee628f769210e44ae05f195e6de69c9829e441f517290719999`

Tags:
- `version-control`

Contract:
- content-paths写后同时核对完整entries目标、更新payload字节和仍在所选边界内的保留payload指纹。

Proves:
- 写后改写合法blob实际字节但保持OID，无论属于更新目标还是保留所选对象，都拒绝发布并恢复原index字节。
