### Case RECORD-NATIVE-CREATION-HANDLE-PROOF-001: 原生创建的权限验收与恢复绑定实际写入句柄

Tests:
- `test:6d203be36d4399854c3eb2e1a96845a148461293b66ad3e52f4983e4f37874d6`

Tags:
- `record-operations`

Contract:
- 精确 mode 与原生 creationMode 互斥，原生请求仅用于不存在的目标；创建须交回实际 FileHandle 的 dev、ino 与 mode，写后路径的当前权限不能替代写入归属证明。

Proves:
- 默认原位和 atomic 独占创建均交接实际 handle mode；关闭后改变权限使 capture 失败，恢复 CAS 拒绝删除该文件，并保留其内容及后来权限。
- 索引写入前失败时，已证明的实际创建可完整撤销；opaque writer 无 handle mode 证明时保留文件并返回 partial-or-unknown。
- 混合 mode/creationMode、对已有目标使用原生请求均在写入前拒绝，缺失目标不创建、已有目标不删除；unchanged 路径也拒绝非法原生请求而保持目标不变。
