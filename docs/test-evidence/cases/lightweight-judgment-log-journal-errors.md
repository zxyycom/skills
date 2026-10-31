### Case LIGHTWEIGHT-JUDGMENT-LOG-JOURNAL-ERRORS-001: 非 BUSY 不重试

Tests:
- `test:8895941f0d0e602c804947ea9e6f4d0175ff942432f75037c30113633320972f`

Tags:
- `lightweight-judgment`

Contract:
- WAL 初始化等待只处理 SQLite BUSY；其他初始化失败不重试、不发送。

Proves:
- 在 WAL prepare 边界注入 SQLite 非 BUSY errcode=10；仅一次尝试后退出4、fetch=0且没有调用记录。
