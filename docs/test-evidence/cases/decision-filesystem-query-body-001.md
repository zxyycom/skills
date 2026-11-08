### Case DECISION-FILESYSTEM-QUERY-BODY-001: Show 拒绝符号链接决策正文

Tests:
- `test:ddc6bc32caf655dc4e099bea61603c6cf6a1b4b8cdf8a06cf0ee7a8180daabab`

Tags:
- `decision-records`

Contract:
- show 读取所选正文时须拒绝符号链接。

Proves:
- 真实 CLI 同一普通正文 show 成功；替换成指向外部文件的 symlink 后返回安全错误，外部内容与索引保持。
