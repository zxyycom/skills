### Case VIDEO-CREDENTIAL-ISOLATION-001: 媒体环境与诊断不泄漏 ambient 凭据

Tests:
- `test:0a200b318558dfc3a468d2ff6d107e38b38f2aefb3b780180010cf1623bf9055`
- `test:2859719998aaaffef7062969beaafb622016f2cf9dd691c8452d31050d725ea2`
- `test:f59829da3c9c3772ce1c1c80a54b2e74c306896bc5925e4812300555185606aa`
- `test:f76db0dd0c0448f1807ca23cb0d5e86477c2fc0ea1ae0b5775074bdeee1df9f4`

Tags:
- `video-understanding`

Contract:
- 媒体/OCR 子进程只继承明确需要的环境，诊断不保存凭据行、私钥块或跨 chunk 拼接出的敏感值。

Proves:
- 环境移除 token、代理、解释器注入与共享 PATH/cache；离线隐私标志不可削弱，跨 chunk 凭据与私钥正文不进入保存诊断。
