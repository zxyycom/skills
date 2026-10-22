### Case IR-INDEX-PAYLOAD-PHASE-001: index准备获取合并但独立保护保留

Tests:
- `test:ccfdc888bf69ef67e043afdd4d1ca86d75a4c2c6a67fd482e29133dbb6b41b13`

Tags:
- `investigation-report`

Contract:
- IR index初始snapshot与initial phase复用同一pending；独立写前、锁内以及发生写入时的写后payload检查继续存在。

Proves:
- 真实Git trace显示changed共5次cat-file批读取（含固定HEAD一次），unchanged共4次；分别对应单次准备P、独立P、锁内P及必要写后P。
