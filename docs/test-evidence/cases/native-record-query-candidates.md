### Case NATIVE-RECORD-QUERY-CANDIDATES-001: 候选身份发现与资源诊断

Tests:
- `test:02be1afba29927483d2d794e1c26ee20f82a5bb6cba7e530a083c1576f2cc96a`
- `test:0deb551bad25d25b014365ae465bfcc4710bd89f634721cbc851376ef4643e24`
- `test:17f2c43244c1324a88c7537bd6c409d1564c62039e908da6a2a2bdb0fe65fdb3`
- `test:203dc2ec1de15733a9cffe85facbcbee34a2a4a21f757ba6ce33e8f4c820eb93`
- `test:2ac3d8341e3f1d7d3ac7a29fb3c56d1af04bdb525c0bbd5638fb703d5a7f28db`
- `test:397b90aad353a0d212e2a3d6c5b5c304477dd0a7b94f37da7cda4bef21b71da1`
- `test:731db1e72ca7ae4f427534f34ad3764ab9d7c6bc6bd4d297cbd65da622dc9650`
- `test:8b186c00dc71eea7115110f5d998c11598329b669f04e7729e15206530704a08`
- `test:da79c216f6f0d38e409a9c5ec3cb0ba30242c286549c913c4648fb5ed55fb3a6`
- `test:e5913b8c51fd69bdb648464129b1c89cc31b5851cf2dc96ed9275d2bfaa49772`

Tags:
- `record-rust`

Contract:
- 候选查询须使用声明身份与受管资源事实，不读取或接纳无关资源。

Proves:
- 双域私有 fixture 验证损坏 scaffold、身份、缺失依赖、资源 owner、别名与链接诊断。
