### Case NATIVE-RECORD-QUERY-TEXT-001: 文本匹配与 Unicode 预览

Tests:
- `test:1dba0f2c24048a57c8c2cae7b9bc24aa2bf27714c7b668091e2f52a5d492a2c2`
- `test:2dd5cfb9f260460fe6bc7ebadaf03e2571c6d94c5b5b58b7f724213f0979e42e`
- `test:5036447766aa136e06dbc1506144875da8dc01a08c35688a215d4cd83cabdf60`
- `test:9815a50e99136096dbc2182a7348b6f9a194ba58f70ce292c5639ca58ca6d845`
- `test:e15ea36afe1e6621bceb6c83adb199f35a24fb9983f4125296d8dd194eb2208f`

Tags:
- `record-rust`

Contract:
- 文本查询须保持查询匹配语义及原始 UTF-16 预览位置。

Proves:
- 空白、大小写、跨段匹配、归一化和预览截断以手写预期区分。
