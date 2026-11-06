### Case NATIVE-RECORD-RESOURCE-EVIDENCE-001: 调查资源的成员与身份快照

Tests:
- `test:70d4d0fec68f17a6d4e9a921608025810371a7639cf64a355c4bace7a9a2d6a5`
- `test:b688c812559d0d577649359ec1c80be16b3341b39dab327d292ae8f65e257774`
- `test:dadcd4a41bbf8cfb7445fa58237fbc18dbcd8a55fc4f7b54f58222088196c6da`
- `test:e51358e3de5ecfe218f689f0d069146cc171b422ae153756b25bc99f11ba8f03`

Tags:
- `record-rust`

Contract:
- 资源证据须区分缺失、空目录、选定 owner 和无关成员。

Proves:
- 私有资源与 Git 快照验证成员选择、目录身份替换及忽略无关 payload。
