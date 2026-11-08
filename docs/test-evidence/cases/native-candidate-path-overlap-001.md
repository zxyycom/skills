### Case NATIVE-CANDIDATE-PATH-OVERLAP-001: 候选安装路径跨盘与包含关系

Tests:
- `test:12dcdd1312b4214e2c88d3c358eed941c46337b2d9451d6515b3686d51836641`

Tags:
- `record-rust`

Contract:
- 私有安装不得允许源与目标相同或相互包含；不同 Windows 卷不能被误判为包含。

Proves:
- 使用 Windows 路径语义的固定样例区分跨盘、UNC 卷、相同、双向包含和邻近目录；不证明真实 Windows 安装成功。
