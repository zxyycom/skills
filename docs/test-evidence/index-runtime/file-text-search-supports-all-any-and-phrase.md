### Case FILE-TEXT-SEARCH-MODES-001: 文件搜索支持 all、any 与 phrase 匹配

Entry:
- `tools/shared/tests/file-text-search.test.ts > all and any can match terms on different physical lines, while phrase cannot`
- `bun test --test-name-pattern="^all and any can match terms on different physical lines, while phrase cannot$" ./tools/shared/tests/file-text-search.test.ts`

Contract:
- all 和 any 按规范化词项跨行匹配，phrase 只匹配连续规范化短语。

Proves:
- all 返回分别包含两个词项的行，any 返回包含任一查询词的行。
- phrase 不把跨行词项当作短语，且只标记连续短语所在行。
