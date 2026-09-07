### Case FILE-TEXT-SEARCH-UNICODE-001: 文件搜索规范化 Unicode 并保留原始坐标

Tests:
- `test:21a7de12bce08ba9dea96ce87a8910a68642ff670a1017914c891f8193ea3fa0`
- `test:994ac7a9f24487b0e845f26ce14664cae65bed41b10b1612272e18aa9c7f46b3`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索以 NFKC、无大小写差异和 Unicode 空白规范化进行匹配，同时以原始文本的 UTF-16 坐标输出预览范围。

Proves:
- 全角字母和不换行空格组成的短语能被 ASCII 查询匹配。
- 返回的列、预览文本和范围仍对应未规范化的原始行。
