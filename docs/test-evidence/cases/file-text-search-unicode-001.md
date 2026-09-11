### Case FILE-TEXT-SEARCH-UNICODE-001: 文件搜索规范化 Unicode 并保留原始坐标

Tests:
- `test:4d4514ca0c1099e9c3e23addf36e3119f1f42e5a1c4ba8757cba8b3c0c0ceadc`
- `test:a7af4124f5961a44b43b3495cfb1b479989b7d144b478d27eed1874f3a796c8e`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索以 NFKC、无大小写差异和 Unicode 空白规范化进行匹配，同时以原始文本的 UTF-16 坐标输出预览范围。

Proves:
- 全角字母和不换行空格组成的短语能被 ASCII 查询匹配。
- 返回的列、预览文本和范围仍对应未规范化的原始行。
