### Case NATIVE-RECORD-TXN-MOVES-001: 资源 owner 迁移竞争与恢复

Tests:
- `test:0a2ad3b3ca4715d4cc9d193b13494339ea08318344831b4e101b364986598906`
- `test:3c5ee849cf0b1a6e6a0daf56ed55c05440092c040f411f685c7c903fee29824f`
- `test:46dfc4af88be69b4c1fffb0ecc81cce409c6938dcd25bb69acb8e739f8a59cdb`
- `test:4c314420ceef95321b2477f4954eff158e80b9d7baad88c24714a94415d1f660`
- `test:6d383d141615fa13ce6c2a8dcd477fa168ff545f002de722964e44221a63f825`
- `test:9116e68f7422597f1de3440edcc1b2e34f83b2687f1187b25ee5b5e34153257e`
- `test:96dec840e22cf72f8fac6c87fe7a69656e187f5226333ec0f553c45d6ea34e7e`
- `test:be2809839407ba38d7326bc5676ea908bf48c0bd5be96a4127a203fc9aa70321`
- `test:c297ebc12e45db1b41878e2670c19a51b0323f8ffcb73a75f6afe411f9fc0d7e`
- `test:c33ffb0042b8427f088a57b250c5d99629a29d680fac528166851cf1f04c04ab`
- `test:d53a80b079fc7417691235d24486ccc0b06484e4b4870aa6a7448b63c5c8d337`
- `test:d5fbf9dbb5d024fce5b10d28265fa119e6b11b9c944c3ee9529b1ed940850d08`

Tags:
- `record-rust`

Contract:
- 资源 owner 先独占复制并验证，再更新引用或索引并退出旧源；失败保留实际事实和必要恢复材料。

Proves:
- 真实目录和可控阶段验证目标碰撞、源与目标编辑、硬链接别名拒绝、复制后失败保留源和副本、提交点及旧源退出后的读取失败；不证明跨文件原子性或所有系统调用竞态。
