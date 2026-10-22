### Case VERSION-CONTROL-CONTENT-PAYLOAD-DEFAULTS-001: 显式payload范围与完整默认验收

Tests:
- `test:3ee2fa24585ea4fa2544e9826707a478f613630603f1329eafe56d622ecb8eb2`
- `test:b030c1e463213f8c6e6c418cf46a40844346c51a864abe6465026fa9e0ab84f2`
- `test:fadd77b41bec90606e6c8875dfe5614e675acfc8d33e89b64aea5944cc9049ac`

Tags:
- `version-control`

Contract:
- pending snapshot省略payloadScope或指定scope时验证完整范围payload；只有显式content-paths策略才将payload验收收窄到contentPaths，完整成员身份仍受保护。

Proves:
- 未选对象缺失、腐败或实际类型错误时，content-paths读取、修改与unchanged仍成功且未选条目不变；显式scope、默认snapshot和普通完整读取均失败。
