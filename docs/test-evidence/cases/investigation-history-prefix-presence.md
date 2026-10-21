### Case INVESTIGATION-HISTORY-PREFIX-PRESENCE-001: 历史身份前缀保持真实来源存在语义

Tests:
- `test:01a2c79ef223004496492bbc5c6142817b7c0016077ea1044ad17087a581b56e`
- `test:4af295ae9121c5da2587ab30323060733c13ce4fefb8afb8e9930a11fb7acc8a`
- `test:67a6df0a16c64e22a390785c088198651c7d60516fc5c57ce41bfab25b7fc708`
- `test:6acb5737348c2ee97ea2dbc9111968496a9a24842b33ae61637c5d598b181bd8`
- `test:6af47d7a32979ba04ffde3c64837a41fbdc7de2cb434fb1a97cc394d7cc8b471`
- `test:d6f04791558284ce7d30ae39884b2b69acba7b040595f7e8362fecad857a03d8`
- `test:db6865d82d95f4695055589516a1062f14fa36db1cec20ac0b81fc951a896d36`
- `test:feb2576e503f22c9d876a844aabd3dc7ec385f7eca4b68f09a36c990990e6f31`

Tags:
- `investigation-report`

Contract:
- 历史关系警告依据 HEAD 真实直属正式来源身份或合法 basename，不以索引声明替代来源存在事实。
- 有限前缀不足时按固定 revision 补读，换行和 UTF-8 截断不能制造错误身份。

Proves:
- 纯身份解析对 LF、CRLF 与孤立 CR 的前三行来源前缀均返回正确 ID。
- 真实 Git 历史中的 legacy、moved 及长前三行 EOF 条件不产生前序缺失警告；HEAD 来源身份与索引声明不一致时，仅报告该前序尚未进入 Git HEAD。
- 纯身份解析对前三完整身份行之后的 16384 字节 UTF-8 截断保留正确 ID，截断末尾的 replacement character 不改变身份。
