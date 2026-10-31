### Case RECORD-QUERY-DEPENDENCIES-001: 两域发现按实际依赖验图

Tests:
- `test:026448ab9563a473616fb961d53eba9156c4955114b372a5704905b61b108f0b`
- `test:b9f5a11b124e38a2873dab76d78907dee7bd7fb6e5f3fc9579aa8d07bd1aed35`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 无关系 list/metadata/show/content 只验严格索引与实际依赖；关系条件和 trace 验完整领域图。

Proves:
- 同一坏发布图下两域无关系发现成功，关系筛选与trace失败；IR同时含无效资源owner声明而无关系发现不作全域owner审计。
