### Case FILE-TEXT-SEARCH-UNICODE-RANGE-001: 文件搜索将组合字符命中映射回原始范围

Entry:
- `tools/shared/tests/file-text-search.test.ts > maps a normalized grapheme match back to its original combining-character range`
- `bun test --test-name-pattern="^maps a normalized grapheme match back to its original combining-character range$" ./tools/shared/tests/file-text-search.test.ts`

Contract:
- 规范化后命中的组合字符必须映射为覆盖原始基字符与组合标记的范围。

Proves:
- 由分解重音字符构成的原文可被预组合、忽略大小写的短语查询匹配。
- 输出范围覆盖原始的两个 UTF-16 code unit，而非规范化后的单个字符。
