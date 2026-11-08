### Case NATIVE-RECORD-QUERY-TEXT-001: 文本匹配与 Unicode 预览

Tests:
- `test:04b5197d280d9e1ca5602a75e4da90251accd6571894f48828d91ac18dd2360c`
- `test:1dba0f2c24048a57c8c2cae7b9bc24aa2bf27714c7b668091e2f52a5d492a2c2`
- `test:2dd5cfb9f260460fe6bc7ebadaf03e2571c6d94c5b5b58b7f724213f0979e42e`
- `test:5036447766aa136e06dbc1506144875da8dc01a08c35688a215d4cd83cabdf60`
- `test:9815a50e99136096dbc2182a7348b6f9a194ba58f70ce292c5639ca58ca6d845`
- `test:e15ea36afe1e6621bceb6c83adb199f35a24fb9983f4125296d8dd194eb2208f`
- `test:f50da40d7f042d587f059b8de6f5bae92c65c910b342de7de863f9a17c40b7fa`

Tags:
- `record-rust`

Contract:
- 文本查询遵循归一化、大小写与分段匹配语义；预览位置使用原文 UTF-16 坐标。
- 同一行的重叠及相邻命中先合并为原文范围，再应用范围数量预算；预览字符预算以 UTF-16 单元计。

Proves:
- 手写预期核对纯空白查询拒绝、空白与大小写归一化，以及 all 跨段匹配和 phrase 单段匹配。
- 单词及多词的 NFKC 展开保持原文 UTF-16 坐标；多词映射到同一原文范围时正确合并。
- 多词范围按原文位置排序并合并；零预算区分有无命中，恰好用满的完整结果与额外范围导致的截断分别核对。
- 字符预算截断 emoji 时，预览保留未配对高代理项的 JSON 转义并标记字符截断。
