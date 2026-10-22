### Case DR-INDEX-PAYLOAD-WORKSPACE-RECHECK-001: index独立复核工作区发布投影

Tests:
- `test:4c4f908e4d5ece427383f8878f3aa776a8a5856dd7230e397ba2a57460e32584`

Tags:
- `decision-records`

Contract:
- 固定 H 可调用内复用；W 发布投影须独立重读并验证，只有新鲜实际字节等价时才可复用已验证的不可变解析。

Proves:
- 首次W读取后修改合法发布title，独立写前返回stage-source-changed且Git pending保持原样。
