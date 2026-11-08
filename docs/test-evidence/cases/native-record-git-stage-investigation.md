### Case NATIVE-RECORD-GIT-STAGE-INVESTIGATION-001: 调查正文与资源的选择性 stage

Tests:
- `test:51e2039addb976c9e176869a41e03b5d8e759ba2a589e42606fbc5c044d876e7`
- `test:5657f62961e6f35b8785c5106d093bc4368031eb55a361aff30c053591f827d4`
- `test:8253972dac86001aebb9421c7ccdf4fb365fa23e6fdedea2e76618ffb9d6ee20`
- `test:cd7ba3529a572030fbc9d4e6d7208bd3106a82bca48ef30b916a1b7272d92686`
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `record-rust`

Contract:
- 调查 stage 必须限定受管正文和资源 owner，不覆盖非目标 pending。

Proves:
- 真实 Git 验证缺失资源根、受管与忽略资源、foreign owner、删除和 pending-only 定位。
