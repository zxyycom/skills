### Case FILE-TEXT-SEARCH-MODES-001: 文件搜索支持 all、any 与 phrase 匹配

Tests:
- `test:090180d666f72d2fbbc97deec0522e6e32e2eac38117faabca38a765880313a9`

Tags:
- `index-runtime`

Contract:
- all 和 any 按规范化词项跨行匹配，phrase 只匹配连续规范化短语。

Proves:
- 只有 Alpha 与 beta 分处两行的输入：all 返回行1/2，any 返回行2；不存在同一行同时含两词的干扰样本。
- phrase 对这两行返回零 hit，不把跨行词项合并成短语。
