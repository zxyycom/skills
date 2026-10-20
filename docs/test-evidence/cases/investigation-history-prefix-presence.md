### Case INVESTIGATION-HISTORY-PREFIX-PRESENCE-001: 历史身份前缀保持真实来源存在语义

Tests:
- `test:01a2c79ef223004496492bbc5c6142817b7c0016077ea1044ad17087a581b56e`
- `test:45fe5575710fd1d5bffdd62f57564ba2fcb11d8d2353740a734b9b91d8646802`
- `test:4af295ae9121c5da2587ab30323060733c13ce4fefb8afb8e9930a11fb7acc8a`
- `test:67a6df0a16c64e22a390785c088198651c7d60516fc5c57ce41bfab25b7fc708`
- `test:6acb5737348c2ee97ea2dbc9111968496a9a24842b33ae61637c5d598b181bd8`
- `test:6af47d7a32979ba04ffde3c64837a41fbdc7de2cb434fb1a97cc394d7cc8b471`
- `test:cb7e2070448ec59ffa803e7c7931f2e76516d01c7c4aa0f3fc14b0e85c5ef591`
- `test:db6865d82d95f4695055589516a1062f14fa36db1cec20ac0b81fc951a896d36`
- `test:f7d62d056b003a055ed55d46f75b5f4543181c45e0aa4ff04b5f2f0b225946d7`
- `test:feb2576e503f22c9d876a844aabd3dc7ec385f7eca4b68f09a36c990990e6f31`

Tags:
- `investigation-report`

Contract:
- 历史关系警告依据 HEAD 真实直属正式来源身份或合法 basename，不以索引声明替代来源存在事实。
- 有限前缀不足时按固定 revision 补读，换行和 UTF-8 截断不能制造错误身份。

Proves:
- LF、CRLF、孤立 CR、legacy、moved、HEAD index 缺失／损坏／不一致及长前三行 EOF 条件，保持原身份或缺失警告。
- 前三完整身份行后的 UTF-8 截断不制造缺失警告。
