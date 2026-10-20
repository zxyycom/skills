### Case INVESTIGATION-STAGE-RESOURCE-SAFE-DELETION-001: 路径安全不阻断未引用资源合法删除

Tests:
- `test:01b1e2a2c7d5a36b633f4e1c75f3d2047c82348e46c779d93aed505e1579d6de`
- `test:7cbfbdfae01b6b13fba83244da4770c6873c3954a6f97c245f96ef05a1764e55`
- `test:f4b57d786fae1f125ff614141e0aa840262fd4ce8b7d04b93bdcf1c77b215960`
- `test:fc7353d2b230868f4dcae48249904427ebdc3820716777ea533d9b9db3a10034`

Tags:
- `investigation-report`

Contract:
- 所选资源树用工作区与 HEAD 成员并集表达删除，未被直接引用的基线资源允许根、目录或文件缺失。

Proves:
- 真实资源验证在 root、owner 或中间目录缺失时返回无资源，不把合法删除当作路径错误。
- 文件缺失的真实 domain stage 代表成功，Git 暂存差异仅含对应基线资源删除。
