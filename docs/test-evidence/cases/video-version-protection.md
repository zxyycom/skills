### Case VIDEO-VERSION-PROTECTION-001: 不支持的证据版本保持原文件

Tests:
- `test:561d5c36a7a8e00e6e7edad6f7d308d2da8615eecf0dd7f620213626cd4b3353`
- `test:5d71cf66b183abe0e57c7d3a3f2bc2a75d64bb769023bd40beb0fc2e9c02437a`
- `test:94b6e0a44c622b841565d946ded774884b63372ded0c2cce99319a9c7e71e3fa`
- `test:99d5248dd28921dfdee3473626579be591d07b9c5aa28e0a731d69f7fdaeafdd`
- `test:a0ad3414ad88f0116c07fb3236e0356233f8ff1d516bdd47d47e78fbc9790560`

Tags:
- `video-understanding`

Contract:
- 仅支持当前证据协议版本；旧版、未来、缺失或非数字版本不得自动迁移或重写。

Proves:
- 所有公共命令都拒绝不支持版本并给出使用新 output 的恢复说明，文件字节、mtime 和目录成员保持不变。
