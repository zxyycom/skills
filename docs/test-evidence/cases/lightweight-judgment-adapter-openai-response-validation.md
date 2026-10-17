### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-004: OpenAI 答案关联与协议失败

Tests:
- `test:dc25c3de7e348af80ff562abb1f1d4b67340944a05548458e76235a21953c46f`

Tags:
- `lightweight-judgment`

Contract:
- 直接 `openai-decisions` 原生数组合同的答案 name、顺序、题型、候选集合和数值必须满足所选请求；协议失败不形成可采用的部分答案或自动重发，不等同于合法 refusal 产生的 partial／refused。

Proves:
- 错误 name、题型、布尔候选、重复候选、越界 confidence／概率逐一返回 invalid_response、attempts=1、单次 fetch；远端私有值不进入诊断。
