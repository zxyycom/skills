### Case FILE-TEXT-SEARCH-UNICODE-RANGE-001: 文件搜索将组合字符命中映射回原始范围

Tests:
- `test:1ed1ef93c9382da15910dc706e1af8d84058808768da84b8d103ca6bd16ea290`

Tags:
- `index-runtime`

Contract:
- 规范化后命中的组合字符必须映射为覆盖原始基字符与组合标记的范围。

Proves:
- 由分解重音字符构成的原文可被预组合、忽略大小写的短语查询匹配。
- 输出范围覆盖原始的两个 UTF-16 code unit，而非规范化后的单个字符。
