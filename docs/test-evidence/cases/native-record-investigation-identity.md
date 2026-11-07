### Case NATIVE-RECORD-INVESTIGATION-IDENTITY-001: 调查身份和资源 owner 迁移

Tests:
- `test:0be58a2b3a8b3ad6d2b0822133d53bd04ebcf05ff3426e3dadd212ff819755db`
- `test:1be2551068f1dbd2f5f6f17176cd1d5aa098007c969e0a9a208a3ec7b937b00d`
- `test:210e246eb965575015d92f12d897b44850e13030ea07292bc62e6012fb417e79`
- `test:2cb229d38e0af08f4f36e2969685ac10b1a5fc84d257a9b6626381bd180867a8`
- `test:57ab1cf9db8328e4923e957ecde429e9a6bef4a5b75e93e423ca2113285d42c7`
- `test:a3aa7a386c422674fea73eae9c5da2e54dc24e0d53d77d795d109ca099e88d2e`
- `test:a7199bb8a1f2ce0570b0afe3177b152cc02aaa589dc6ad4d028642ff17e191a7`
- `test:ad74713b84803d52e15fb3e2e900e7298f5c042d38c9a5c05c3d898f9926d0d0`
- `test:bfc8a2107b179a5b9d77513e890c07bc7f9c82ffabb7f10f65a2dc1ad21bb9de`
- `test:d28f17e5917ea20ba7bf492b89ac67e8d7e037d0a6888e67eb102b5ec941a2c2`
- `test:d2e7274e123d72bb36bfc9571659c924d4ce7a46104ee54fc947216a04cbac1a`
- `test:e06b9f36fcea339561836d2509411bc1559f02bfa2db7956bfec7aa33d4450ab`
- `test:ec61230fa824193b5c31dcb62aab6dea9bb17d3648e622c8e0a5f1fc5dd31166`

Tags:
- `record-rust`

Contract:
- 调查身份变更须保护引用、历史与资源 owner，并保留未受管对象。

Proves:
- 私有文件及必要 Git 核对身份、引用、共享 owner、忽略文件和 Linux mode；真实 CLI 资源复制部分写入失败时核对原正文、索引、旧资源、未知路径及已验证备份。
