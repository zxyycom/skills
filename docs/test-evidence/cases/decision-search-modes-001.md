### Case DECISION-SEARCH-MODES-001: Decision search 以三种模式检索完整 Markdown

Tests:
- `test:f8b0772cfc1840c342361e4225f2475a8e1bc4c9244cce50fe9cb5b38e1de645`

Tags:
- `decision-records`

Contract:
- DR content 在已发布范围的当前 Markdown 中支持 all、any、phrase。

Proves:
- 真实 CLI 验证默认及显式 content 的 all、any、phrase 命中与非命中，命中返回稳定 ID、语义 sourcePath 与预览。
