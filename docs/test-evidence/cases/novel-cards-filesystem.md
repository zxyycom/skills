### Case NOVEL-CARDS-FILESYSTEM-010: 文件边界与资源限制

Tests:
- `test:694968bfc1cf52b763a4c1f86d0eb9c87a1ab8e2bc6364c4f95b91370414db2f`

Tags:
- `novel-cards`

Contract:
- 卡片区只接收普通单链接Markdown，超限集合不能给部分成功。

Proves:
- 符号链接、硬链接、超过2MiB文件及非Markdown成员分别失败；非法UTF-8按card-format定位具体文件，源码CLI退出1并保持错误JSON与stderr诊断。
