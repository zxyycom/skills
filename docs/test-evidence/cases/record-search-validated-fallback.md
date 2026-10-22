### Case RECORD-SEARCH-FALLBACK-001: 发布索引不可用时明确失败

Tests:
- `test:0d2ae6f24858f27382cb98a1f65f6b2e5e193dc623417a66aaac80574102ad27`
- `test:5ca568fbc7e41374b47e1affb1872fc2a7f91c29293343e6354249ed8a579e92`

Tags:
- `record-search`

Contract:
- content 必须加载发布索引，不隐式重建来源。

Proves:
- 两域缺索引返回错误且不生成成功搜索元信息，索引仍不存在。
