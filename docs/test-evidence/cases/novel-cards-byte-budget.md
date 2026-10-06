### Case NOVEL-CARDS-BYTE-BUDGET-016: 集合字节上限

Tests:
- `test:fb647efff938ffc385ba1111c9ae45fc5f84d2d8f0002df8e75f5b3e30f8d4b4`

Tags:
- `novel-cards`

Contract:
- 单文件最大2MiB、完整集合最大20MiB，超出后不得截断成功。

Proves:
- 十张各2MiB合法卡完整读取；再增加一张合法小卡以source-limit失败。
