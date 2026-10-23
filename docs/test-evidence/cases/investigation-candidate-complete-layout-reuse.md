### Case INVESTIGATION-CANDIDATE-COMPLETE-LAYOUT-001: 候选准备复用完整正式身份与 owner 字节

Tests:
- `test:2d6ec414a92b7423a35e2f05073291213f7f1b77022e60e201d9395a4dc6a088`

Tags:
- `investigation-report`

Contract:
- 同阶段已有完整非空正式来源时，候选准备直接复用身份和必需 owner 字节，不为同一身份依据额外读取索引或正文。

Proves:
- 预先取得完整 layout 后，候选准备与读取的 fs.readFile 根直属路径观测为空，共享资源仍 ready，references 只包含候选及必需 owner；该读取计数本身不覆盖 fs.open／FileHandle。
