### Case INVESTIGATION-CANDIDATE-NEW-001: new creates an isolated canonical candidate scaffold

Tests:
- `test:25df2ef098f3b8f8c86e5a80dc4171562c11e89e2b9cd658c8b55acdfa308aac`

Tags:
- `investigation-report`

Contract:
- `new` 在集合锁内以 `_candidate.<investigation-id>` 创建规范 authoring scaffold，候选不进入正式报告集合。

Proves:
- 创建结果保留规范 frontmatter 与四个固定正文节，scaffold 有效而空正文只使 body readiness 为 incomplete。
- 正式报告发现只返回正式成员，候选身份单独可发现。
