### Case NATIVE-RECORD-TXN-MODES-001: 候选身份更新和资源模式保护

Tests:
- `test:1bb5d80c64f3b448820651bea26bf6e9f4badfc9bfbedebc1cc807c3af10a681`
- `test:38702b816ecf06943568a469498b371f32755a2fcef8fc547ac313f5a6ab4d66`
- `test:7579e5914f25e79f5f2695d0803ff458d9b8fe96a22bc7975ad0e7cfd8ea425c`
- `test:89c538434801cd34d66949b383dc992a5a5ffdfabbb88b03607ee92ddfbca9cc`
- `test:b1e6f7d7ecfc77bc948aa2b8c812d2ad9ba5a1a3ceed3a0b0961d16b788a3490`
- `test:cff62acb230bfc3153ec1ed97b995ee529389da31406d82b02f254c04a5ab795`
- `test:d5c9ffedb12d1218988b91bb2793e9dc4193295840ec4d088b5b75d0d74dc08a`

Tags:
- `record-rust`

Contract:
- 同路径候选更新及资源迁移须保留提交事实和适用平台属性。

Proves:
- 局部事务核对写入、未写、postverify、目录模式与成员漂移；Unix mode/umask 与 Windows 内部 mode 投影分别验证。
