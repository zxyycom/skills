### Case INVESTIGATION-DIRECTORY-PHASE-SAFETY-001: 目录阶段事实保持相关路径安全与局部范围

Tests:
- `test:095c4ab5dd07c730391b844c4833a6ba149dbb8c2313e35710c3b08cf85e21e9`
- `test:176d0825a17ff9daafa756b1fcd60ac4b6eb81db19bb1dda1cb03fadf365435a`
- `test:1de079343025cacf4bb9106f1c380985fd76a5e7e85f866cf8d6cb1cc604181d`
- `test:21a0cea9074d83ccb2422e0da6933abcea63c105b847f3abeee27f27cd55b35c`
- `test:27f2ace6849169e73112c9a581e4ce37187403451027112975dfd29b5fe98808`
- `test:322774e7c4b2f33efb5b7f55ee855d729f1ab0068cee88b06714fcd81952b804`
- `test:341fbaef86504e1bc059193ec23c750da82d6c0da9a008c0165a3d6693be5092`
- `test:a0c97803f1fa3ad95dcf242364c2f283d562e43d8b580c99454d82723fab7711`
- `test:add2c2548623cb39a9c4f72d16c0b9ef9b81d5dacc06c28e014cf79831f39f47`
- `test:cd907aea977bafad81ae8e88d2c2a9f5eb1e8c65eb6f541442fa8c0dd1da14f6`
- `test:cf639c6a228fa1ee4437219bbdd66300d68f15647a60c7f401d30858d5ecdcd5`
- `test:d970772bdabc8ba64b2d7b443c625724e5f500ef456f2fefaa7ee39a2ea086af`
- `test:e5140993183515dab321312cdca4bb7281879afa8870d7532412edafb725a48e`

Tags:
- `investigation-report`

Contract:
- 目录名字索引由单阶段拥有；每次使用复核当前身份、类型、canonical 及相关名字匹配，检查范围为所选树与直接路径。

Proves:
- 同阶段根、owner、中间目录和末端文件的 symlink 或同字节普通身份替换，在真实资源验证取得字节前失败；缺失与 casefold 匹配变化被重新发现。
- 无关根 owner 增删及直接依赖 sibling 活动可继续，未遍历无关树；真实 domain stage 对稳定所选目录两阶段各枚举一次，普通含空格名字合法。
