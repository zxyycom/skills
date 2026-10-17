### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-013: 大图 Base64 的独立 Node 校验

Tests:
- `test:c16b5bcc847f5966749c1a1b98aedce5f730432726d4fff2ee5e2e7f095aab3b`

Tags:
- `lightweight-judgment`

Contract:
- 在既有 16 MiB 单图上限内，合法内联 PNG 不得因 Base64 长度产生正则栈溢出；dry-run 不取凭据、不建库或发送。

Proves:
- 独立 Node 进程运行复制后的分发 bundle，1200×1200 合成随机 RGB 静态 PNG 解码字节超过 4 MiB、Base64 超过 500 万字符；可解压像素核对通过，预览成功并逐字保留 assets Base64，attempts=0 且日志库不存在。
