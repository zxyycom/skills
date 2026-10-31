### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-005: 图片识别与零发送门禁

Tests:
- `test:af0969fd3d717a24d789d052d414f7d8332928297ee48be184e400793fb2fc8c`

Tags:
- `lightweight-judgment`

Contract:
- images 关闭仍递归扫描 state、instructions 与全部 criteria；不读取路径或 URL，非法图片必须在凭据、建库与发送前拒绝。

Proves:
- 健康 credential getter（含 legacy key）在关闭图片与坏节点矩阵中读取数=0，fetch=0、attempts=0 且无数据库；精确 input/images 诊断，坏 URL/path/Base64/MIME 不泄漏到诊断。
