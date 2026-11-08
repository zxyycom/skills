### Case NATIVE-RECORD-DELIVERY-001: 候选离线制品身份与私有安装

Tests:
- `test:1d8d32f8d1ef354dcf0f44a35e1027d0f3803ddc3728d7b159fdaf2884b722dc`
- `test:203bc4ecb3e34d308e0b6e243cc2287814ce131b66c15d0e482cb9ca97c42c43`
- `test:d81b00e28434ccbefe546245bffe96260e5a8c520c1ad0baef4b97ff4d91a906`

Tags:
- `record-rust`

Contract:
- 离线安装须验证候选 manifest、目标及资产字节，失败时保护无关文件。

Proves:
- 固定资产 fixture 验证 Linux 与模拟 Windows 目标、版本和 hash、损坏、不安全目标及源目标双向重叠拒绝、私有安装替换回退及无关文件；不证明 Windows 原生运行。
