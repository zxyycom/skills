### Case INVESTIGATION-RESOURCE-DIRECTORY-JOURNAL-001: 资源根与子目录创建在chmod前进入实际写集

Tests:
- `test:a42db37dc47f0eff5c814738654e50ff99e4c7c7f234799a5127ea27d526bcd0`

Tags:
- `investigation-report`

Contract:
- 目录mkdir完成立即记录实际identity，后续chmod失败的恢复须覆盖这个实际创建范围。

Proves:
- 分别在目标根和nested目录首次chmod前抛EIO，原报告／index恢复、目标owner目录无残留，rolled-back证明完整旧范围。
