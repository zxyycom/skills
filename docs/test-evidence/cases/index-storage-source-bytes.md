### Case INDEX-STORAGE-SOURCE-BYTES-001: 内部source保留原始字节且旧text语义不变

Tests:
- `test:11b63eff8238fba9adb6b38c9ed6dd1fb65eeea43282d909764420a13a5e2ab8`

Tags:
- `index-runtime`

Contract:
- storage内部source读取返回实际payload字节与严格UTF8文本；普通text读取继续返回相同解码文本。

Proves:
- 带BOM和中文的文件原始bytes完整保留，source与普通text入口均返回去BOM后的相同文本。
