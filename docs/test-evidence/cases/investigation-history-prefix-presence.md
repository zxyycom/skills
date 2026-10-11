### Case INVESTIGATION-HISTORY-PREFIX-PRESENCE-001: 历史身份前缀保持真实来源存在语义

Tests:
- `test:01a2c79ef223004496492bbc5c6142817b7c0016077ea1044ad17087a581b56e`
- `test:091dc245debd8c47ac31dc956ce58ae0a514a9ae2e49161666d6f7f068438bd2`
- `test:45fe5575710fd1d5bffdd62f57564ba2fcb11d8d2353740a734b9b91d8646802`
- `test:4af295ae9121c5da2587ab30323060733c13ce4fefb8afb8e9930a11fb7acc8a`
- `test:67a6df0a16c64e22a390785c088198651c7d60516fc5c57ce41bfab25b7fc708`
- `test:9dc9258f43667200239dda8304ffc1cd9f54ed70a1812a4b0c7992d627a0b963`
- `test:aaad6b573fde3d0fdbf35454a266a6034e411255e0cc90c06d34bd8ed0c3494d`
- `test:cb7e2070448ec59ffa803e7c7931f2e76516d01c7c4aa0f3fc14b0e85c5ef591`
- `test:db6865d82d95f4695055589516a1062f14fa36db1cec20ac0b81fc951a896d36`
- `test:f7d62d056b003a055ed55d46f75b5f4543181c45e0aa4ff04b5f2f0b225946d7`

Tags:
- `investigation-report`

Contract:
- 历史关系警告依据 HEAD 真实直属正式来源身份或合法 basename，不以索引声明替代来源存在事实。
- 有限前缀不足时按固定 revision 补读，换行和 UTF-8 截断不能制造错误身份。

Proves:
- LF、CRLF、孤立 CR、legacy、moved、HEAD index 缺失／损坏／不一致及长前三行 EOF 条件，保持原身份或缺失警告。
- 前三完整身份行后的 UTF-8 截断不制造缺失警告。
