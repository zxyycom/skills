### Case VIDEO-CREDENTIAL-ISOLATION-001: 媒体环境与诊断不泄漏 ambient 凭据

Tests:
- `test:674eeddb0c91e8276edd8a482414ef69c30175bcdd2be1fcedfde6bed5531dd1`
- `test:7f1e70e81950f76b463cdf4d4f8e13c889ab41538a4ebcda729239ef2d404605`
- `test:d1a30a39914022e55c80e38d4ff97e4772dcf24ba641bf99531a839e09d72e9e`
- `test:f98c1c4013d95ae0ee12ee81c734992d478ec4433e061c4bac2b6282ec53b231`

Tags:
- `video-understanding`

Contract:
- 媒体/OCR 子进程只继承明确需要的环境，诊断不保存凭据行、私钥块或跨 chunk 拼接出的敏感值。

Proves:
- 环境移除 token、代理、解释器注入与共享 PATH/cache；离线隐私标志不可削弱，跨 chunk 凭据与私钥正文不进入保存诊断。
