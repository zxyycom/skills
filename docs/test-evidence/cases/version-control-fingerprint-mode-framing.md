### Case VERSION-CONTROL-FINGERPRINT-MODE-FRAMING-001: 指纹模式不改变完整读取失败边界

Tests:
- `test:12dd73f39418f96b4ac6b7cb246a1fb3ef875eebb4b7e0cef67c493fe27eb6c4`
- `test:37c9422356ccc14dc17ed38d5a4ec8785781b6fec2624e3b627e27b79f7b05cc`
- `test:397a34c3b2af7ab678b0004d4d8cf80b634bacb16ee6fc6ff3e11573a3c157dd`
- `test:44a9d7709c71c5cc7871f725d260c89b509cf6d3239a3d6dcb91d43b004f3f3f`

Tags:
- `version-control`

Contract:
- 是否计算SHA256不改变完整二进制frame、payload、stdout预算与transport失败边界；无指纹结果不得作为指纹结果完成。

Proves:
- 两模式跨逐字节chunk得相同prefix和size，none模式要求指纹完成被拒绝。
- 两模式拒绝missing/type/identity/size错误、截断、separator和多余frame；丢弃全部内容时仍累计完整256MiB stdout预算。
- 真实子进程即使已输出合法frame仍保留非零退出失败，保留prefix之后的payload截断仍失败。
