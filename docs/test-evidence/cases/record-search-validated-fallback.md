### Case RECORD-SEARCH-FALLBACK-001: 发布索引不可用时明确失败

Tests:
- `test:20c586ae93b58ba4ed0cbf155137da3cd62d44144bc15dc20f15407d6dc961b4`
- `test:49e1994720374660546d8291f5bac26dbbf1fd801e16f0ae22f8a1d2fe4abb4f`

Tags:
- `record-search`

Contract:
- content 必须加载发布索引，不隐式重建来源。

Proves:
- 两域缺索引返回错误且不生成成功搜索元信息，索引仍不存在。
