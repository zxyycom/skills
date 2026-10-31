### Case INDEX-PREPARED-BYTES-001: baseline 保留原始字节与规范安全门槛

Tests:
- `test:bb9c8ca13af5e76a8d7200a58b4d9147b9ba70954507a5caf2d3e8d164232e54`

Tags:
- `index-runtime`

Contract:
- selected baseline 准备先严格验结构、字段与实际字节；native 消费时要求 canonical，实际字节不能由相同解码文本替代。

Proves:
- UTF-8 BOM 原始字节得到保留；非法编码、不安全路径及坏 JSON/字段拒绝准备。合法非 canonical baseline 可交接 selector，但同证明交接及 raw check/preview/write 在 build/fresh 前均拒绝，不丢严格门槛。
