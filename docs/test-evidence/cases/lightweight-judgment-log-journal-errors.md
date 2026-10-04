### Case LIGHTWEIGHT-JUDGMENT-LOG-JOURNAL-ERRORS-001: 非 BUSY 不重试

Tests:
- `test:dd96d7b7d6370ccda6562beda9f351535b36aa8c9ca00c755f7cdf14292be3b7`

Tags:
- `lightweight-judgment`

Contract:
- WAL 初始化等待只处理 SQLite BUSY；其他初始化失败不重试、不发送。

Proves:
- 在 WAL prepare 边界注入 SQLite 非 BUSY errcode=10；仅一次尝试后退出4、fetch=0且没有调用记录。
