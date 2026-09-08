### Case DECISION-DISCARD-INVALID-ESTABLISHED-SOURCE-001: Discard 在非法已建立来源前零写入失败

Tests:
- `test:7badd69674fb9e14482ff182c5dc7c2d956590e359e69f787f2359b28df6575c`

Tags:
- `decision-records`

Contract:
- discard 必须先验证完整已建立来源；任何 archived alignment:null 来源都必须阻止 candidate discard，不能以删除后回滚替代写前拒绝。

Proves:
- 命令以 alignment/no-change 诊断失败且 stdout 为空。
- candidate Markdown 的内容和 mtime 以及持久索引字节均保持不变。
