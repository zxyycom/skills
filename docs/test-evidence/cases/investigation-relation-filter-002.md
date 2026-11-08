### Case INVESTIGATION-RELATION-FILTER-002: list and search combine direct relation selectors with existing query boundaries

Tests:
- `test:22553d21c863dc21798a280d0b18bd14733b14d128ae4e292d8b8c6a0766e20c`
- `test:73479222dafc8d884fbf44a2eea98268613686098becebbb29e1c7228d8e876c`
- `test:f0286f573f8276c416a9ef97f2606fe1738d431507e4c7e6703652669f74b7e4`
- `test:fd65ce18c71f88b9a16472c41b676428c87785cb9588e3c542b5b7e4b32d0532`

Tags:
- `investigation-report`

Contract:
- `list` 与 `search` 在发布 snapshot 中按目标的直接关系筛选；类型和目标须匹配同一条边，筛选先于分页或内容匹配。
- 筛选证据与文本命中分别承接；缺发布索引时搜索失败而不伪造成功计数。

Proves:
- 共享关系投影节点证明同边条件及重复 evidence 去重；IR 真实 CLI 分别验证前序、后继和双向分页、total 与 facets，以及 metadata 标题命中与 filterRelations 分离。
- IR 真实 content 搜索返回正文预览和关系摘要证据；缺索引时失败且没有 searchInfo。上述是组合证据，并非每个方向或变体均经真实 CLI 覆盖。
