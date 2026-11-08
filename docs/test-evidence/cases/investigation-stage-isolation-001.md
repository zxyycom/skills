### Case INVESTIGATION-STAGE-ISOLATION-001: stage --scope index keeps report Markdown outside selected index staging

Tests:
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`
- `test:a0f7e8d91d7cab17bf5ef5c757033826305a9f83f591226e2057905066410af4`

Tags:
- `investigation-report`

Contract:
- index scope 的暂存更新只包含派生索引，不将报告正文纳入写集。

Proves:
- Decision definition 真实 Git 测试的共享 stage_index 更新路径仅含 decision-index.json，报告来源路径由调用方持有。
- IR definition 的真实 Git fixture 调用同一 stage_index 成功刷新索引；IR CLI 源码的 index 分支原样调用此共享入口。本组合不声称运行了 IR 报告工作区差异 fixture。
