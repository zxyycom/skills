### Case INVESTIGATION-RESOURCE-DIRECTORY-JOURNAL-001: 资源根与子目录创建在chmod前进入实际写集

Tests:
- `test:b9b76347826937e38d7d295ccc4f0c087a730a392827c4674d9cd26a9995841a`

Tags:
- `investigation-report`

Contract:
- 目录mkdir完成立即记录实际identity，后续chmod失败的恢复须覆盖这个实际创建范围。

Proves:
- 分别在目标根和nested目录首次chmod前抛EIO，原报告／index恢复、目标owner目录无残留，rolled-back证明完整旧范围。
