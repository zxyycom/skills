### Case INVESTIGATION-STAGE-RESOURCE-SAFE-DELETION-001: 路径安全不阻断未引用资源合法删除

Tests:
- `test:4ec8c8ef253abfc83511c8abbf9e2059cfd47550d9ffcb0ac9f7a7684d22e3b8`
- `test:62ca22f0ed9eab1abc06f2cc2ad38045eebfd1c976939cefb2944fe674b334e4`
- `test:70acd3648bd0bcc0d13ec5fb067af81d24c1b6a507a850f7da0463afc8b29d6b`
- `test:e8fcbd1d8f46e971aea77e6fa512a28d5ab02ae484f084fc09dba5359596c7a9`

Tags:
- `investigation-report`

Contract:
- 所选资源树用工作区与 HEAD 成员并集表达删除，未被直接引用的基线资源允许根、目录或文件缺失。

Proves:
- root、owner、中间目录和文件分别缺失时 domain 成功且只将对应基线资源写入 pending 删除。
