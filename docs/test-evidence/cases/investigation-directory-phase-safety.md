### Case INVESTIGATION-DIRECTORY-PHASE-SAFETY-001: 目录阶段事实保持相关路径安全与局部范围

Tests:
- `test:0b622f8e129d4c4cdc47bddc8be91a58bcad3a0f1a03c4022a6ae0b48f0c570c`
- `test:3aa24f63d05d667a19fcb34dda346ebf92c15cab1308ebd253302019c871633d`
- `test:43f184cdb9dd632d3bfb7273491fd5a4f421e73daab1a5ab042977a16bf8cdbd`
- `test:683260bf4d93c38f07f443d3880df1ad0bf80bec437abeac7a7f2a4a73cb26ab`
- `test:7c0e215b0b65248374b2677df0949166902cee81693344e7c890c75a0732b848`
- `test:8f1cb90bbeb1e6f4461e39c0eaf8300f4a62df7a03002ab1012d9f2d22728eae`
- `test:9648d59435310d6e7a1d5325f6ae9ab0478ddffeb2c4a3f8ed81f5d5f575c09e`
- `test:9f6755d4488b742672e945cc5e1eb5d9b5f4b1211a13079f70e7373cabbc37c7`
- `test:a27fa10ef54ebe63fe64e298b4323f5505699c007e262631934b10985b378c8f`
- `test:bc0b39d8cdca08187cf2c2cf5e20c6056f60096106aacfa3ae916178991e04bd`
- `test:e1b46b5f78aaed9a2a42dda751caaa9dc3450def1a50b89c6dc14b508729480b`
- `test:e1f8b6e5dd25e7a03116cd4e7afaaef0661197c98407502bd308564465153428`
- `test:f08804e77904bd24a9ff49579c86ba2e0856792ffee436569c43380d17ce842b`

Tags:
- `investigation-report`

Contract:
- 目录名字索引由单阶段拥有；每次使用复核当前身份、类型、canonical 及相关名字匹配，检查范围为所选树与直接路径。

Proves:
- 同阶段根、owner、中间目录和末端文件的 symlink 或同字节普通身份替换，在真实资源验证取得字节前失败；缺失与 casefold 匹配变化被重新发现。
- 无关根 owner 增删及直接依赖 sibling 活动可继续，未遍历无关树；显式构造两个独立目录事实阶段时，稳定资源根与 owner 每阶段各枚举一次，含空格的普通文件名合法。
