### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-005: 图片识别与零发送门禁

Tests:
- `test:aa38040efdcf5fb437f1dcb704e694fb228c5d51badef83c1c617b87e1e9f5b9`

Tags:
- `lightweight-judgment`

Contract:
- images 关闭仍递归扫描 state、instructions 与全部 criteria；不读取路径或 URL，非法图片必须在凭据、建库与发送前拒绝。

Proves:
- 多合同、多作用域和嵌套节点在零 fetch／attempts=0 且无数据库下拒绝；URL、路径、坏 Base64、错 MIME 不进入诊断。
