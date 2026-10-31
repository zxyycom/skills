### Case INVESTIGATION-STAGE-RESOURCE-SAFE-DELETION-001: 路径安全不阻断未引用资源合法删除

Tests:
- `test:6e0b732af90f00e2a17b3a313c6bd81467e97add4bf1845548f6a45ae8cf2774`
- `test:9f9e9a0c5a7574400d6d1064d42b6719bea1031a76097b3b5fbc5b07ad8f9f32`
- `test:d155a791c95c79060cac596c653a864632255af63456ed769389c0a3fc89c7c5`
- `test:df83049dfcb6619b74e821e8b55368e66f42a7dca465ca9a87c91f618b79bbe1`

Tags:
- `investigation-report`

Contract:
- 所选资源树用工作区与 HEAD 成员并集表达删除，未被直接引用的基线资源允许根、目录或文件缺失。

Proves:
- 真实 FS 删除 root、owner、中间目录或末端文件后，资源验证返回无资源，不把允许缺失的路径当作安全错误。
