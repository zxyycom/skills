### Case GATE-MARKDOWN-LINT-001: Markdown 门禁只启用六项批准规则并限制维护范围

Tests:
- `test:98b628bcf9bf3ae33eb3e449b6d0cce53baf180ac07ccd35779127a17c38a12e`

Tags:
- `repository-tooling`

Contract:
- 项目 Markdown lint 使用 blocking policy 且只启用 no-reversed-links、no-missing-space-atx、no-empty-links、no-alt-text、reference-links-images 和 table-column-count 六项规则；历史资源、candidate、upstream 与原文不进入维护范围。

Proves:
- 生产配置规则列表与六项批准规则精确一致；排除路径中的坏链接不影响有效 maintained.MARKDOWN 的通过。
- 维护范围内同一文件改成空链接后 Check failed，报告 sourceFileCount 为 1。
