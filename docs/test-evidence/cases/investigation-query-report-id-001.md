### Case INVESTIGATION-QUERY-REPORT-ID-001: show 与 trace 解析调查名称

Tests:
- `test:8ad09f135902ceb10e7afd2f94bbfbd10c422906f74101b2e94a7e79c44bd1b0`
- `test:d2f29b2b4a4e5053b2f3f2c4358cde771ef56387619f414a6a44d57eb8931d18`

Tags:
- `investigation-report`

Contract:
- show 与 trace 按调查索引中的身份解析名称 selector。

Proves:
- 私有来源中 show 以 one 取得 260101-one 的当前正文；trace 以 one 选择同一 anchor，并在预算不足时报告完整拆分事件。
