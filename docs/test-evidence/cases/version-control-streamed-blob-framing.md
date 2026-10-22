### Case VERSION-CONTROL-STREAMED-BLOB-FRAMING-001: 流式blob协议完整验证与预算

Tests:
- `test:37a3bbfcc621309f0007e5f121e0d6794cee77072be620d518eaaa29a54f21a0`
- `test:3dbe0d787ec29cc3533262038dd07a5e16e6904a79ae90562fef103088dc7850`
- `test:44832b7ff3b8e8ff6ec3a792eeead1c6724e951fb7dd5577442b3ff6195eab23`
- `test:b19d94f9d05c6c4e3db8d4cb8113babfa69249603bf71d13b2355027320acd65`

Tags:
- `version-control`

Contract:
- 流式读取独立验证对象身份、blob类型、长度、payload、separator、EOF和完整batch预算。

Proves:
- 逐字节跨chunk二进制prefix、空blob与实际payload指纹正确；错误header/ID/type/size、截断、多余记录和separator失败。
- 未保留内容仍受stdout与stderr各自完整256MiB输出预算约束，超预算声明在大分配前拒绝。
- 有无指纹两模式中，有效payload framing但超过stderr预算的真实子进程仍被拒绝；诊断只有限保留，不把完整stderr预算降低为保留量。
