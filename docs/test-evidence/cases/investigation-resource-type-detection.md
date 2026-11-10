### Case IR-RESOURCE-TYPE-DETECTION-001: 库识别结果与未知编码分开处理

Tests:
- `test:c49c2f5c1ccc86e5f3fdeb27a26fac2e9e4dcdd05eb0754c4f3fb8d0c27b9812`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 现成库的格式与文本倾向映射到资源提示策略；编码未知不直接判为二进制，Unicode BOM 文本不误用空字节规则。

Proves:
- 固定字节输入得到 gzip/warn、UTF-16LE 文本、未知文本编码/info 和 suspected-binary，归档映射为非文本类别。
