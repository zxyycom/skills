### Case VERSION-CONTROL-STREAMED-BLOB-FRAMING-001: 流式blob协议完整验证与预算

Tests:
- `test:12dd73f39418f96b4ac6b7cb246a1fb3ef875eebb4b7e0cef67c493fe27eb6c4`
- `test:44dc5af453a380c36b6b5efe52ec42aa4eb63cb614d3013dfb6a807637fc3dad`
- `test:77bf7fb1bc2562662f5528d5beaef0f082919395679b1981cd64ddd532f7d5c8`
- `test:c4cd0d6985092af7d060a58666b16a79f3de9453d7a78845059d500597a7fb1d`

Tags:
- `version-control`

Contract:
- 流式读取独立验证对象身份、blob类型、长度、payload、separator、EOF和完整batch预算。

Proves:
- 逐字节跨chunk二进制prefix、空blob与实际payload指纹正确；错误header/ID/type/size、截断、多余记录和separator失败。
- 未保留内容仍受stdout与stderr各自完整256MiB输出预算约束，超预算声明在大分配前拒绝。
- 有无指纹两模式中，有效payload framing但超过stderr预算的真实子进程仍被拒绝；诊断只有限保留，不把完整stderr预算降低为保留量。
