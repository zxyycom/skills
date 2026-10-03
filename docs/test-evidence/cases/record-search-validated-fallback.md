### Case RECORD-SEARCH-FALLBACK-001: 来源降级验证且不写发布索引

Tests:
- `test:784bced1dea307fedafb8abe16ad0b192acebf3194036d1e726be07f410d83f1`
- `test:901eacf20eeaae03ab0c206002a4bc866dbc8e27ae23342c611483adeca974e9`

Tags:
- `record-search`

Contract:
- content 在索引缺失或不可用时只能完整验证当前来源后只读降级；必需来源失败不生成成功元信息。

Proves:
- 两域缺索引搜索返回 validated-source/current/fallback=true，但索引仍不存在。
- 非法 Decision 来源保持失败且无 searchInfo；Investigation 缺必需 metadata 索引为 error、searchInfo=null。
