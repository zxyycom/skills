### Case NATIVE-LEGACY-ACTIVATION-001: 原生交接最后激活说明并清理已验证旧文件

Tests:
- `test:9ce2a16880402994e329372a97deb26667973fce696a32e9f5daeac82e6bda70`

Tags:
- `repository-tooling`

Contract:
- 原生更新先准备新运行时并验证，最后切换 skill 入口，随后只退役经过验证的旧文件。

Proves:
- 私有 fixture 的验证回调执行时旧说明仍在且新二进制已准备；成功后新说明、完成 receipt 和无关文件存在，旧文件及备份目录退出。
- 回调使用替身，本测试不证明真实二进制、依赖或用户环境可运行。
