### Case VIDEO-MANIFEST-INTEGRITY-001: 清单身份一致性在全局边界验证

Tests:
- `test:bf7623c612ba5c3b1809e1986ba9d4858001b8998f96ba4a1677e892c1f60cc8`
- `test:f7ef9365df0b2961abde2d56cd82ffca911c719958eec990e512f3cefe62167b`

Tags:
- `video-understanding`

Contract:
- 清单请求、材料键、标识符与引用关系须有效；全局身份损坏与单个 payload 不可用具有不同影响。

Proves:
- 旧/非法结构、重复和悬空标识阻断清单读取；payload/index 不一致只标记相关材料不可用，诊断不泄露原始损坏内容。
