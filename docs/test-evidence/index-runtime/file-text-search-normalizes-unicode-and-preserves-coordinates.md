### Case FILE-TEXT-SEARCH-UNICODE-001: 文件搜索规范化 Unicode 并保留原始坐标

Entry:
- `tools/shared/tests/file-text-search.test.ts > normalizes NFKC, case, and Unicode whitespace while retaining original UTF-16 coordinates`
- `bun test --test-name-pattern="^normalizes NFKC, case, and Unicode whitespace while retaining original UTF-16 coordinates$" ./tools/shared/tests/file-text-search.test.ts`

Contract:
- 文件文本搜索以 NFKC、无大小写差异和 Unicode 空白规范化进行匹配，同时以原始文本的 UTF-16 坐标输出预览范围。

Proves:
- 全角字母和不换行空格组成的短语能被 ASCII 查询匹配。
- 返回的列、预览文本和范围仍对应未规范化的原始行。
