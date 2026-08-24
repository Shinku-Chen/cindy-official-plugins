# Claude Desktop Buddy（Cindy 插件）

把 Cindy 的会话状态实时投射到 Claude Desktop Buddy 硬件桌面伙伴（FoloToy AI Passport）。

## 它做什么

- **状态面板（独立可用）**：即使没插硬件，Cindy 左侧面板也能实时显示会话总数、运行数、等待审批数、token 用量，以及等待审批的提示。会话列表按 `Waiting > Working > Idle` 聚合排序。
- **硬件投射（需连接）**：BLE 连接硬件后，自动把 heartbeat 快照推给设备，硬件屏幕显示聚合状态与审批提示。
- **只显示，不回传批准**：本版把"等待审批"作为状态显示在硬件上；批准/拒绝仍由用户在 Cindy 里操作。

## wire protocol

遵循 Claude Desktop Buddy 公开的 Hardware Buddy BLE 协议：

- Nordic UART Service：`6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- RX（主机→设备）：`6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- TX（设备→主机）：`6e400003-b5a3-f393-e0a9-e50e24dcca9e`
- 收发为换行分隔 UTF-8 JSON；30s 无心跳判连接死亡。

## 架构

```
subscribe 旁听 Cindy 事件 (did-turn-*/did-approval-*/did-user-input-*/did-session-*)
        │  topics: turn / session / activity（activity 含审批与用户输入边界）
        │  聚合状态
        ▼
main.js ──► BroadcastChannel ──► panel.html（停靠面板）
        │
        └── cindy.node.request ──► node/worker.cjs ──BLE──► ESP32 硬件
```

- `main.js`：电子脑（浏览器沙箱）。聚合会话状态、生成 heartbeat、维护面板。
- `node/worker.cjs`：随包 Node 进程。加载 noble 连接 BLE，收发 NUS 行分 JSON；noble 加载失败时回退"无硬件测试模式"（协议/面板仍可用）。
- `panel.html`：停靠面板。

## 使用

1. 在 Cindy 安装本插件并**立即开启**（或在插件页启用）。
2. 左侧面板出现「Claude Buddy」；硬件未连接时可先看会话状态。
3. 点面板「连接」（或让 AI 调 `buddy_connect`）触发 BLE 扫描，找到 `Claude-*` 设备。
4. 首次连接按硬件屏幕提示输入 6 位配对码。
5. 连接后硬件实时显示状态。

## 局限

- **BLE 实现**：node worker 用 vendored `webbluetooth`（Web Bluetooth 规范 API + SimpleBLE 后端，自带 prebuilds 预编译二进制，Windows 走系统蓝牙栈，无需 node-gyp/VS 编译）。文件在 `node/vendor/webbluetooth/`（自包含，含 prebuilds）。若某平台无对应 prebuilds 则回退测试模式（不影响面板，只连不上硬件）。
- **审批单向**：不回传批准决定（Cindy 无程序化审批接口）。
- **扫描超时**：webbluetooth 的 `requestDevice` 找不到设备时不 settle，worker 侧已自主加 SCAN_MS 超时返回 `NOT_FOUND`。
