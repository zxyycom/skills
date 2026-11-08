### Case DECISION-ID-QUERY-001: Show 按索引身份读取当前来源

Tests:
- `test:3b88c658f2cf70da23bb880d6e971be8ecef2ddd924c243c13b2c2608233492c`

Tags:
- `decision-records`

Contract:
- show 使用已发布索引定位来源，读取正文时核对其身份。

Proves:
- 原生 show 对 active 索引条目按名称读取当前正文；正文不完整但身份匹配时保留正文并发出 warning，身份不匹配则失败。此节点不覆盖 archived show 或全部 frontmatter 字段。
