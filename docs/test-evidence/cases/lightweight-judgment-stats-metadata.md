### Case LIGHTWEIGHT-JUDGMENT-STATS-METADATA-001: 本地元数据与独立字节记录

Tests:
- `test:189baa58a92574752090c51cdb65bcbfbd3eab6e3b7095810b01810a1f5e231d`

Tags:
- `lightweight-judgment`

Contract:
- run/index 成对且唯一，标签合法；仅本地元数据不加入 HTTP，关闭正文留存仍记录实际 UTF8 字节。

Proves:
- 非法元数据在建库／发送前返回2；合法请求不含 run/tag，记录两正文NULL及精确字节；重复 index 在发送前返回4且总发送一次，参数值 stats 不误路由。
