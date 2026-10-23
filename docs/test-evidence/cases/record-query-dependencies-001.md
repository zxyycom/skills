### Case RECORD-QUERY-DEPENDENCIES-001: 两域发现按实际依赖验图

Tests:
- `test:87a6a7eea8fde9d5abb21891e6188651e13576cbd6f455c6cc54d19377ea430c`
- `test:a4c41c0f4744d19825b1397dc64e6cf8daad986ccd5450cc7be6458e5eee914b`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 无关系 list/metadata/show/content 只验严格索引与实际依赖；关系条件和 trace 验完整领域图。

Proves:
- 同一坏发布图下两域无关系发现成功，关系筛选与trace失败；IR同时含无效资源owner声明而无关系发现不作全域owner审计。
