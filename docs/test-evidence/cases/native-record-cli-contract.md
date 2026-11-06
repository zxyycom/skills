### Case NATIVE-RECORD-CLI-CONTRACT-001: 双域 CLI 参数与事务结果通道

Tests:
- `test:2dfd48c79c1d1110d13aa7a23dbfae990286309490720cb51802b13bd7fc659b`
- `test:6e47f8cda3c29049a6d3c915454f4c20fe67bb4cc28b7a38cdd5d44d6ef55fe9`
- `test:ecef0aaaa4ac24a6ed06850d00de83b8bf00f0179b73df5fa2179902f00acbc5`
- `test:f45af7a8b5ca245c57f637a22e845979a89aaddfad7b0fcd3046b7819ef7b1fc`

Tags:
- `record-rust`

Contract:
- CLI 参数错误、帮助和事务事实须用正确状态和可判读输出表达。

Proves:
- 真实双域进程验证 argv、非 Unicode 参数、JSON 单结果、退出码及计划与实际写入的区分。
