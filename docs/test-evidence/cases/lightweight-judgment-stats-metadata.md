### Case LIGHTWEIGHT-JUDGMENT-STATS-METADATA-001: 本地元数据与独立字节记录

Tests:
- `test:21cd1678f07ea102ecbe6c7d33e5920e19acb19ed857530713580bace2ea4d7c`

Tags:
- `lightweight-judgment`

Contract:
- run/index 成对且唯一，标签合法；仅本地元数据不加入 HTTP，关闭正文留存仍记录实际 UTF8 字节。

Proves:
- 非法元数据在建库／发送前返回2；合法请求不含 run/tag，记录两正文NULL及精确字节；重复 index 在发送前返回4且总发送一次，参数值 stats 不误路由。
