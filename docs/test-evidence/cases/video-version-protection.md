### Case VIDEO-VERSION-PROTECTION-001: 不支持的证据版本保持原文件

Tests:
- `test:20b99635773822f0290c1b9ea0e4b3b3056cc5bc573db3890df57775620ddf91`
- `test:88f0c3102b5a5913ae1d63d818aed47c7b7c61656bc0deed3e04fcd892a43f4c`
- `test:9497452574b2206c81ac8b8e424554ca96ae4241d0f9bc6458d297eafbde3e59`
- `test:ca919ad00ea1dc254cb9e08f386b0a5110fe164dfe51d6842b5bf253fcf18adb`
- `test:ec63f91e42de0f984ac8b06d3081ad62d8952398447d8b137eb9ffed6547209d`

Tags:
- `video-understanding`

Contract:
- 仅支持当前证据协议版本；旧版、未来、缺失或非数字版本不得自动迁移或重写。

Proves:
- 所有公共命令都拒绝不支持版本并给出使用新 output 的恢复说明，文件字节、mtime 和目录成员保持不变。
