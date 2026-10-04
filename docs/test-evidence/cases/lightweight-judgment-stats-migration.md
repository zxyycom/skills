### Case LIGHTWEIGHT-JUDGMENT-STATS-MIGRATION-001: 普通 writer 原子升级旧库

Tests:
- `test:148612a93f57a848eee8d7c41ff74d907b10993e5d0b24f4b7670901b9813882`

Tags:
- `lightweight-judgment`

Contract:
- 仅启用日志的真实调用 writer 在发送前将合法 v1 原子增量升级到 v2，保留历史数据并让新增旧元数据为 NULL。

Proves:
- 真实 v1 样本的请求正文与 tokens 保留，新列为空；普通 logged 调用后 version=2，新增调用持久化 run/index 和请求字节。
