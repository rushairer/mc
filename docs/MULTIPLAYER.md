# Multiplayer — 联机部署指南

> 面向 `npm run server`（Node.js WebSocket 服务端）的本机、局域网与公网部署说明。
> 客户端多人菜单默认连接 `ws://localhost:8080`，可在游戏内 Multiplayer / 多人游戏 菜单修改。

## 1. 快速开始（本机）

```bash
npm run build          # 构建前端（可选，冒烟/发布用）
npm run server         # 启动服务端，默认监听 ws://localhost:8080
```

- 打开浏览器访问 `npm run dev` 或 `npm run preview`（构建产物 `dist/`），进入 **Multiplayer / 多人游戏**。
- 服务器地址保持 `ws://localhost:8080`，填写玩家名，点 **Join Server / 加入服务器**。
- 控制台出现 `Player connected: <用户名>` 即加入成功。

**世界存档**：服务端每次关停（Ctrl+C / SIGTERM）会把世界快照写入 `./server-world.json`，下次启动自动恢复。

## 2. 局域网（LAN）

1. 找到本机局域网 IP（macOS：`ipconfig getifaddr en0`；Windows：`ipconfig`）。
2. 启动服务端：`npm run server`（监听 `0.0.0.0:8080`）。
3. 其他设备连接：`ws://<本机IP>:8080`。

> 若局域网设备连不上，检查系统防火墙是否放行 8080 端口。

## 3. 公网部署（ws://）

在云服务器上：

```bash
git clone <repo> && cd mc
npm ci
npm run server &                    # 或使用 pm2/systemd 守护
```

客户端填写 `ws://<服务器公网IP>:8080`。**注意**：直连裸 ws 无加密，明文流量可被监听；生产环境建议走 wss（见下）。

## 4. 公网部署（wss://，HTTPS 反向代理）

浏览器对"安全上下文"外的 WebSocket 有混合内容限制，HTTPS 页面应使用 `wss://`。推荐用 nginx 反向代理：

```nginx
# /etc/nginx/conf.d/mc.conf
server {
    listen 443 ssl;
    server_name mc.example.com;

    ssl_certificate     /etc/letsencrypt/live/mc.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mc.example.com/privkey.pem;

    # 静态前端（npm run build 产物）
    location /mc/ {
        root /var/www;              # 对应 dist/ 部署位置
        try_files $uri $uri/ /mc/index.html;
    }

    # WebSocket 反代到游戏服务端
    location /ws/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;   # 长连接
    }
}
```

客户端地址填写 `wss://mc.example.com/ws/`。证书可用 Let's Encrypt（`certbot --nginx`）免费签发。

## 5. 常用配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8080` | 服务端监听端口 |
| `WORLD_PATH` | `./server-world.json` | 世界快照文件路径 |

## 6. 当前多人能力与边界

**已覆盖（服务端权威或同步）**：
- 加入/离开、玩家移动、聊天
- 区块请求与方块编辑（`C2S_BLOCK_BREAK/PLACE` + `S2C_BLOCK_UPDATE`）
- 怪物/掉落物/投射物同步与结算（`C2S_ITEM_ACTION`：弓箭、投掷物、喷溅药水）
- 背包/耐久/消耗品/拾取/死亡掉落（P5.2 服务端权威）
- 容器（箱子/木桶/漏斗）内容（P5.3 服务端存储）
- 世界存档快照（P5.3）
- 连接状态与断线提示（P5.4）

**边界（尚不完整）**：
- 工作站 UI（工作台/熔炉/附魔/酿造等）仍是客户端本地结算，未接入服务端权威
- 服务端不会模拟饥饿/自然恢复——客户端上传其本地模拟状态（`C2S_PLAYER_STATE`）
- 喷溅/滞留药水的范围效果仅在投掷者本地结算；滞留云为服务端投射物 + 客户端本地效果

## 7. 自动化验证

- `npm run smoke:two-client`：启动服务端 + 两个无头浏览器客户端，验证加入（服务端日志确认）与跨客户端聊天、`/setblock` 方块权威命令往返。
- `npm run smoke:long`：全新世界长稳 + FPS 采样（真实 GPU 跑 60 FPS 门禁）。
