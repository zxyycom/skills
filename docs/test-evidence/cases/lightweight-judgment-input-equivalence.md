### Case LIGHTWEIGHT-JUDGMENT-CLI-002: 等义输入与单次请求

Tests:
- `test:1f0965dafe5bae6844ab1fed5ee66b2b156f4ca7a9d59f074fdccb757fe05f67`

Tags:
- `lightweight-judgment`

Contract:
- 文件、stdin、内联 JSON 与等义 ask 构造相同原生请求，每次只发送一次。

Proves:
- 四类输入保持同一个对象 state 与问题映射，模拟接收端观察到四次独立单发送。
