### Case LIGHTWEIGHT-JUDGMENT-STATS-RUN-ID-001: CLI 与存储批次 ID 边界

Tests:
- `test:b86359a964aa55690b7b404eaa9022ddd2809cc8a3736239f7c818f4ee13f3e5`

Tags:
- `lightweight-judgment`

Contract:
- run ID 为1–128字符且无空白或控制字符；CLI 与已存数据库各自在输入边界校验，不将非法记录作为合法批次统计。

Proves:
- 长度1与128的已存 ID 保留并形成 measured 首条；空串、空白、129字符与控制字符在 CLI 返回 input／退出2且不发送，在 stats 返回 storage／退出4、attempts为0且无结果或 persistence。
