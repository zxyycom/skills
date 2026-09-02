### Case INVESTIGATION-CANDIDATE-NEW-001: new creates an isolated canonical candidate scaffold

Entry:

- `tools/investigation-report/tests/candidate.test.ts > new atomically creates a canonical candidate scaffold without establishing a formal report`
- `bun test --test-name-pattern="^new atomically creates a canonical candidate scaffold without establishing a formal report$" ./tools/investigation-report/tests/run.ts`

Contract:

- `new` 在集合锁内以 `_candidate.<investigation-id>` 创建规范 authoring scaffold，候选不进入正式报告集合。

Proves:

- 创建结果保留规范 frontmatter 与四个固定正文节，scaffold 有效而空正文只使 body readiness 为 incomplete。
- 正式报告发现只返回正式成员，候选身份单独可发现。
