### Case INVESTIGATION-RESOURCE-INSPECTION-FAILURE-FACTS-001: 资源读取故障与普通验证问题分别承接

Tests:
- `test:20ba4a8f8ad2ac23b2ee08b37cd0153a54b553e4467b6f56feea03643e5447a7`
- `test:219098982118b8a96537b71ac6ea3d116bbeb2110fe41bcf92a1afecd707263c`
- `test:38a2b1ca6ad49b958d3499b7f9ff861526a1be012a0e47565f9ede23984e91fd`
- `test:5bafd0e2aa30d2d66195e9ceb3b3c62e0731b53d3effd1e249f812a9ca3125d0`
- `test:5c4260a281bf92fd60db1f264f134fd86e272dd391eabe51e71da7dc397f15d7`
- `test:6bd0988886f2f6a110e9adfa7c6499360e2a22dc6c6ae76bc77bff72f648bd50`
- `test:86013627102a17ff5a09350e5e57d2f790ac186e0e2b838d8c737b0f42c54fa2`
- `test:8ceb339d4106834a4e60e7b77a34b22e575c0393853354013e51c7f93af89c07`
- `test:b0c4a214056c3aafcd0606272ec8ef7ce3b9497b35bfce7a9c920f13aa028174`
- `test:d26cb47c9ee564ff6abd5c570cee7a543eab35e6f11a025abc8d9b7f695764b3`

Tags:
- `investigation-report`

Contract:
- 资源文件系统边界保留真实读取失败的净化category、operation和目标；写前复核失败不发布，默认候选与查询验证仍消费原issues，普通路径安全问题不附会系统类别。

Proves:
- 第二phase root inspection/resolution/enumeration、owner/intermediate enumeration、file inspection和terminal open的EACCES均输出source-drift、access-denied、实际相对资源目标与对应操作，提示恢复所需访问权限，pending index完全不变。
- 凭据、私密绝对路径和控制字符不进入诊断，不误建议sync-index或伪造mutation。
- 默认issues与详细检查的errors一致，terminal open失败仍保留原regular-file验证消息；普通symlink验证没有filesystem failure类别。
- 已知来源的真实syscall错误即使没有可分类errno，也保留unknown及实际操作/目标，恢复动作针对文件系统读取故障；不误分类为权限故障或普通路径验证。
