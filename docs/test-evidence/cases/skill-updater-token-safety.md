### Case SKILL-UPDATER-TOKEN-SAFETY-001: 非法凭据在 HTTP 请求前处理且诊断不回显原值

Tests:
- `test:9b49ab0cfd64b6f46c51ffa09626a63927ebcf055e9daff4d65d960ca392ac37`
- `test:f252f79a9b570512bf3d715e9219089aeee67a78304037e07d845527b4c312ec`

Tags:
- `skill-updater`

Contract:
- 凭据去除首尾空白后应为不含空白的可打印 ASCII；配置的凭据非法时直接报错，gh 输出非法时归为可区分的匿名原因，诊断不包含原值。

Proves:
- 源码认证入口拒绝含内部换行的环境 token，错误仅说明格式要求，既不切换后备环境凭据，也不调用 gh 或发出请求。
- gh 替身返回含内部换行的 token 时，源码认证入口返回 invalid-output 和空凭据，不发出请求或记录原始输出。
