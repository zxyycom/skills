### Case NATIVE-RECORD-DOMAIN-INDEX-001: 两域索引身份与关系约束

Tests:
- `test:2e07b66789d6f58eb00f835568c9d0bf3d661f800ab454778562aa3bb015f664`
- `test:31264316906f2dd22939b5f1f81b75fb4ad55c79f7ef3fe06d41dfcb134f5fbb`
- `test:45f8d1ac72065e376f8df03fba4a2547bcb71b8dcbbb9e0ff76f4c6614844ad7`
- `test:4e572abfeea52b35c3c4bffc062551f60a2a20ffd64dd908e460bd7d795d107a`
- `test:6f8ceef2bf575191256c65e409c0d46ce6527ed9b5436b966b79d0ae99e45e3e`
- `test:7b51c6051faa3cf1fc1d60e8b03cdc2957686f8099d43631b1ae0db5eacc288f`
- `test:d0e8607153957bc765119ffa5bbdf0deed94952e55c77dc41bd158408293c76f`

Tags:
- `record-rust`

Contract:
- 决策和调查索引须拒绝损坏身份及不满足领域约束的关系图。

Proves:
- 固定索引投影验证身份选择、关系、归档与演进组件规则以及畸形输入拒绝。
