### Case INVESTIGATION-LOCAL-PUBLISH-001: 发布沿用未选来源的发布投影

Tests:
- `test:b0121425b9cc047a4bbeb1e8c9af0f46b5c00b7463184b0fe9de310835e1260b`

Tags:
- `investigation-report`

Contract:
- 普通 publish 验证发布图、候选及必要依赖，未选无关来源沿用发布投影；显式同步仍承担全集来源验收。

Proves:
- 无关正文损坏、资源缺失时 publish 不读取这些 payload 并建立选中候选；其原发布条目与来源 revision 保持，显式全量同步仍失败。
