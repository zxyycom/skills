### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-005: 图片识别与零发送门禁

Tests:
- `test:5d2f18a3c2d73f7c596ba01d1db802340ebacf7e1f62c4619fb5974333cf44d0`

Tags:
- `lightweight-judgment`

Contract:
- images 关闭仍递归扫描 state、instructions 与全部 criteria；不读取路径或 URL，非法图片必须在凭据、建库与发送前拒绝。

Proves:
- 健康 credential getter（含 legacy key）在关闭图片与坏节点矩阵中读取数=0，fetch=0、attempts=0 且无数据库；精确 input/images 诊断，坏 URL/path/Base64/MIME 不泄漏到诊断。
