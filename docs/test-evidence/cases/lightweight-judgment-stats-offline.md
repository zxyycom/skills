### Case LIGHTWEIGHT-JUDGMENT-STATS-OFFLINE-001: 关闭日志仍可离线读取历史

Tests:
- `test:e1d4c21b7b354efbd2123473460c96290bb956006dc2a46fc75caa3f4e159c95`

Tags:
- `lightweight-judgment`

Contract:
- stats 按配置解析历史日志路径但不取环境密钥、不联网；显式 database 跳过配置。

Proves:
- logging OFF 历史库统计成功、attempts0；密钥 getter 与 fetch 断言始终未触发，显式 database 不调用配置读取。
