### Case INVESTIGATION-DIRECTORY-PATH-001: 调查集合路径父级穿越边界

Tests:
- `test:89813b9e1cb9ba0fd40ff077be8d960381971415abca1f131be7acc2cea5ecd7`
- `test:e06b9f36fcea339561836d2509411bc1559f02bfa2db7956bfec7aa33d4450ab`

Tags:
- `investigation-report`

Contract:
- 调查写命令的集合路径须保持在工作区内，不能包含父路径穿越。

Proves:
- 共享 RelativePath 的纯测试拒绝 ../record 和 a/../record；IR 真实 CLI rename 成功接入其工作区集合。
- 源码的 mutation context 将调查目录交给该 RelativePath 校验；本组合不声称真实 CLI 执行了越界参数 fixture。
