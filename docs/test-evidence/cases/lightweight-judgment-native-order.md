### Case LIGHTWEIGHT-JUDGMENT-CLI-012: 原生键顺序

Tests:
- `test:31b8c9b201976a11ca12ff2e1a1864397e9017a9ced2f25493891ea39c4bc0d1`

Tags:
- `lightweight-judgment`

Contract:
- 原生请求序列化必须保留整数外观候选键和 state 字段的输入顺序。

Proves:
- 对 10、2、1 键显式比较发送文本，state、候选与问题顺序均保留。
