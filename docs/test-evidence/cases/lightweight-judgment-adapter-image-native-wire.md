### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-006: TypeSafe 资产与 OR 长上下文

Tests:
- `test:93657aefbaa1d025e00339621cea65cf831e612f70d26ba8731e28820f4809cc`

Tags:
- `lightweight-judgment`

Contract:
- TypeSafe 图像按原作用域转换为 assets 引用；OR Jev 保留内联节点，明确接受其自动长上下文后才发送图片或较长请求。

Proves:
- state、question instructions 与 criteria 的三张不同 PNG 分别转换为不同引用；各 asset 的 base64/format 及 manifest 的 path、scope、reference、尺寸与字节数逐项对应原图，carrier 与专用头保留。
- OR wire 原样保留内联节点且无 TypeSafe 头；Jev 模型、Box 与长输入组合门禁离线核对。
