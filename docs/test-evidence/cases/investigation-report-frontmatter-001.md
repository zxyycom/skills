### Case INVESTIGATION-REPORT-FRONTMATTER-001: 调查 frontmatter 校验身份与结构

Tests:
- `test:efff6796aede05e0c9c88297117d5574a05f230ae84122a7cb6dbc7fc5b82273`

Tags:
- `investigation-report`

Contract:
- 调查报告 frontmatter 必须匹配声明身份并遵守规范结构。

Proves:
- 规范样例通过；期望 ID 不符、插入额外字段以及不带引号的标题均被拒绝。
