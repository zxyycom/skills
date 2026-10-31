### Case LIGHTWEIGHT-JUDGMENT-CLI-002: 等义输入与单次请求

Tests:
- `test:bdd17e0d66f11c85bd269c8f00e3392265b23f5c8c58cac8bc0baa725b6e8d2a`

Tags:
- `lightweight-judgment`

Contract:
- 文件、stdin、内联 JSON 与等义 ask 构造相同原生请求，每次只发送一次。

Proves:
- 四类输入保持同一个对象 state 与问题映射，模拟接收端观察到四次独立单发送。
