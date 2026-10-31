### Case VIDEO-REUSE-INTEGRITY-001: 复用受当前性和依赖材料约束

Tests:
- `test:08fb9941b0259365a59e59626a5e4afa6461eeb02241b339420aafd656fbab46`
- `test:213714838e02d9cef5db52b4134b31f750124d7a8bbe26dc86a3e8b5439aae42`
- `test:30d0d50eade712a2815a74e178c4a54f94b696fb87b5c799c105c6d2e4865fe6`
- `test:8ec1679e07b7b88638df5ac0707a69eb149fed1d27e854a59a0c76a9dd1571ce`

Tags:
- `video-understanding`

Contract:
- 只有输入、参数和所采用材料仍有效时才能纯复用；无关旁挂文件不改变既有材料身份。

Proves:
- 重复 prepare 不启动媒体；变更素材、参数、已采用字幕或缺损产物阻止复用，无关新 sidecar 不使已有材料失效。
