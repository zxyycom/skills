### Case IR-STAGE-WORKSPACE-GRAPH-FAILURE-001: 按阶段保留发布图失败分类

Tests:
- `test:5b4bee1e6a75170794b2295163477e3a767b0b4109ad9a368cd00572982c6c3b`
- `test:6a2b05d9a373c208ea03f103bd3aeb7dea06678c62f959fa01b975a4745aaf45`

Tags:
- `investigation-report`

Contract:
- 初始W发布图非法保持准备失败；准备完成后W图漂移属于source-drift，不得退回初始集合失败。

Proves:
- 将结构合法的W关系改为指向不存在目标，在index、all及domain均区分初始domain-stage-failed与独立写前source-drift诊断。
- 失败不修改pending全部成员身份，也不覆盖并发写入的W发布索引。
