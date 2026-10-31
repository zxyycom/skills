### Case FILE-TEXT-SEARCH-LONG-LINE-001: 长行限量止于首个省略范围

Tests:
- `test:60d542d37ca09dac7acee150bbed4054650f4e34402ce0dc624142c1c60eb614`

Tags:
- `file-text-search`

Contract:
- 超出范围限额时，只需证明确有被省略的合并范围，同时保留原输出字节顺序。

Proves:
- 千个分离命中、上限一时只搜索两个命中，结果和 truncated 精确正确，范围 JSON 保持 end、start 键序。
