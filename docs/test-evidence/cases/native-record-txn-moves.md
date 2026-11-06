### Case NATIVE-RECORD-TXN-MOVES-001: 资源 owner 迁移竞争与恢复

Tests:
- `test:0b724609a1866a0e61c5b7c333c642497afdd9423d2fb0e115d36de808393fee`
- `test:30082373b82651b7904531113aaf9dccb1091b8002ced522cd8fa9b918694754`
- `test:3c5ee849cf0b1a6e6a0daf56ed55c05440092c040f411f685c7c903fee29824f`
- `test:45ab85c84a19d036de10fbd9e301122ac249fb5330f424de171483b8e8971f11`
- `test:46dfc4af88be69b4c1fffb0ecc81cce409c6938dcd25bb69acb8e739f8a59cdb`
- `test:7167ddc1ff85101f3a1df519191933c916eb706fe5440dad36975c37a3bc821d`
- `test:be2809839407ba38d7326bc5676ea908bf48c0bd5be96a4127a203fc9aa70321`
- `test:d53a80b079fc7417691235d24486ccc0b06484e4b4870aa6a7448b63c5c8d337`
- `test:ee128b80b920edb8e37d0fbfb74b2a13af56fb90e1eb512645fc7ee9b62f5ecf`

Tags:
- `record-rust`

Contract:
- owner 迁移须保留竞争者、独立备份和实际提交状态。

Proves:
- 真实目录及受控竞态验证源或目标替换、提交前后恢复与不确定状态。
