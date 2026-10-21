### Case GATE-MARKDOWN-PROOF-READ-001: Markdown 内容证明的正文读取失败

Tests:
- `test:00224e2880eb57b0a5fd940c07f7f45f79e5e3e900387596ad94d841584fede9`

Tags:
- `repository-tooling`

Contract:
- ignored Markdown 正文读取失败必须可定位地扩大执行，不能把不可读内容视为稳定身份。

Proves:
- ignored 源无读取权限时计划为 fallback，摘要含其相对路径并执行 lint；root/Windows 显式跳过。
