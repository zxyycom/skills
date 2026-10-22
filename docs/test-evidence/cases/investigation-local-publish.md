### Case INVESTIGATION-LOCAL-PUBLISH-001: 发布沿用未选来源的发布投影

Tests:
- `test:84025c5acbc9d833665f5857600dc35ef21df8164bccd4b3b36600e723101c02`

Tags:
- `investigation-report`

Contract:
- 普通 publish 验证发布图、候选及必要依赖，未选无关来源沿用发布投影；显式同步仍承担全集来源验收。

Proves:
- 无关正文损坏、资源缺失时 publish 不读取这些 payload 并建立选中候选；其原发布条目与来源 revision 保持，显式全量同步仍失败。
