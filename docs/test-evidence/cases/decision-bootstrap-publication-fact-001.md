### Case DECISION-BOOTSTRAP-PUBLICATION-FACT-001: 首次发布保留已实际提交事实

Tests:
- `test:c24bbfb8f01b144ae9a5921eae643673abca2fcbf0b6db7ec1516b22148142c3`

Tags:
- `decision-records`

Contract:
- 首次 publish 与普通正式事务使用同一安全提交 owner；index 实际发布后的 writer 拒绝不得回撤来源或输出成功 review。

Proves:
- 首次索引 link 完成后注入 writer 拒绝，CLI 非零且 partial-or-unknown，来源保持 active、新 index 保留并可通过 check。
