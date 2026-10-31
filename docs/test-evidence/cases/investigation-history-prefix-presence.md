### Case INVESTIGATION-HISTORY-PREFIX-PRESENCE-001: 历史身份解析与所选索引一致性

Tests:
- `test:2f91ce5df9070eedeb69183d42328ff72ed0ca4bf7c1d4e1b5bfb220e9f7a045`
- `test:3cbc7a8ec4edae287bbaab72fb4fcb6e5e54ec3f15dfd22ae3153072b2a2a922`
- `test:5d8572d51f2adebddee5adc540d592c935462992394a5983874f6ec260142c82`
- `test:a58e1a8151441b413415aa590a87b2bb7d15ce7f93f3349e6440d41f741d13a4`
- `test:e3c15bc6953428dc39ba3f5b4819cd60a448d21e280b57d7c380869018d530db`
- `test:ec86d8af0f19b96a63081ccc52541d9907432d3938438b304df975ae1b7f6752`
- `test:fb90952ba46b63032a69e1e2d2017c14ad2e59bc7712ace5a2675d2bd5982c5e`
- `test:fc87d7bcc5a558fd7a369fc23dfaa5f038ce24fd3d20f1ed95020aecb91fa615`

Tags:
- `investigation-report`

Contract:
- 历史前序的真实身份须与固定 HEAD 索引定位一致，不能从未知正式正文或 basename 自动恢复。

Proves:
- LF、CRLF、CR 与完整前三行后的 UTF-8 截断均不改变纯身份解析；长前三行的精确所选历史正文仍能识别身份。
- 所选历史正文缺 ID、移动但未更新历史索引或 ID 与索引不一致时输出 history-check-unavailable，不伪造前序未记录结论。
