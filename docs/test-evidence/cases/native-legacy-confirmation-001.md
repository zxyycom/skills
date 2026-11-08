### Case NATIVE-LEGACY-CONFIRMATION-001: 旧版升级先验证版本与确认

Tests:
- `test:4b3f03792b0ba7d3e5327533283a3025ee6cf1a06e96edbda1e150890e9e7f43`

Tags:
- `repository-tooling`

Contract:
- 首次交接的原生 skill 版本必须高于旧版，目标写入须经显式确认。

Proves:
- 同版本及拒绝确认均在写入前失败，旧安装与其父目录保持不变。
