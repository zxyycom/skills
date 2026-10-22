### Case IR-STAGE-WORKSPACE-GRAPH-FAILURE-001: 按阶段保留发布图失败分类

Tests:
- `test:2529c8b9dbe2d2b4dfb0adfaf35b8d976cc13dd18ae90eb48a270bcac56b398c`
- `test:dd5476463d902194962cc4bbd1b038d551748518dbf85c251c85350604043f2a`

Tags:
- `investigation-report`

Contract:
- 初始W发布图非法保持准备失败；准备完成后W图漂移属于source-drift，不得退回初始集合失败。

Proves:
- 将结构合法的W关系改为指向不存在目标，在index、all及domain均区分初始domain-stage-failed与独立写前source-drift诊断。
- 失败不修改pending全部成员身份，也不覆盖并发写入的W发布索引。
