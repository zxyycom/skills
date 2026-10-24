### Case INVESTIGATION-HISTORY-PREFIX-PRESENCE-001: 历史身份解析与所选索引一致性

Tests:
- `test:0d29931e54ec55a6bdb332335a2bd18539eef2793666afd118acc7dc98a3ea9a`
- `test:67a6df0a16c64e22a390785c088198651c7d60516fc5c57ce41bfab25b7fc708`
- `test:6acb5737348c2ee97ea2dbc9111968496a9a24842b33ae61637c5d598b181bd8`
- `test:6af47d7a32979ba04ffde3c64837a41fbdc7de2cb434fb1a97cc394d7cc8b471`
- `test:99f17ef5a171b94aff165d06b45861b6e8c548e60f1dde2edf2101d0149ab92b`
- `test:9b1ab1a7b979866ca46023d763560c9209bf3f13517fd341cfd4b30e514d21d3`
- `test:d6f04791558284ce7d30ae39884b2b69acba7b040595f7e8362fecad857a03d8`
- `test:feb2576e503f22c9d876a844aabd3dc7ec385f7eca4b68f09a36c990990e6f31`

Tags:
- `investigation-report`

Contract:
- 历史前序的真实身份须与固定 HEAD 索引定位一致，不能从未知正式正文或 basename 自动恢复。

Proves:
- LF、CRLF、CR 与完整前三行后的 UTF-8 截断均不改变纯身份解析；长前三行的精确所选历史正文仍能识别身份。
- 所选历史正文缺 ID、移动但未更新历史索引或 ID 与索引不一致时输出 history-check-unavailable，不伪造前序未记录结论。
