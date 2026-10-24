### Case INVESTIGATION-NEW-POSTWRITE-IDENTITY-001: 调查新建写后核对相关身份和成员

Tests:
- `test:73d396c503b70d50d172db04d7ab47281fcba2a76b1a1a9d32f62ff5fab26d25`

Tags:
- `investigation-report`

Contract:
- 候选实际创建后须安全重取身份与相关成员，不扩大无关readiness／正式正文；验收失败保留创建事实而不返回成功readiness。

Proves:
- 在link创建目标后加入同ID的另一candidate locator，公开create失败且partial、changed为true，真实ID／path／已写正文保留，scaffold readiness不宣称成功。
