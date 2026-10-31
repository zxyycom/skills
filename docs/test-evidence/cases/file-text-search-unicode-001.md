### Case FILE-TEXT-SEARCH-UNICODE-001: 文件搜索规范化 Unicode 并保留原始坐标

Tests:
- `test:5f8a32f3a6c5aa848ed35d0caa24b976c5ff526d088b3cde093bf497de64337f`
- `test:fbff1dd95980e7514a24caca6e59980eb47b52500723836016fd819e7cf39835`

Tags:
- `index-runtime`

Contract:
- 文件文本搜索以 NFKC、无大小写差异和 Unicode 空白规范化进行匹配，同时以原始文本的 UTF-16 坐标输出预览范围。

Proves:
- 全角字母和不换行空格组成的短语能被 ASCII 查询匹配。
- 返回的列、预览文本和范围仍对应未规范化的原始行。
