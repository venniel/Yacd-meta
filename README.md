> 本项目 fork 自 [MetaCubeX/Yacd-meta](https://github.com/MetaCubeX/Yacd-meta)，并在其基础上做了一些可访问性（屏幕阅读器）优化。

> Yet Another [Clash](https://github.com/yaling888/clash) [Dashboard](https://github.com/yaling888/clash-dashboard)

[English](./README.en.md)

## 用法

安装[twemoji](https://github.com/mozilla/twemoji-colr/releases)以在 Windows 系统上更好地显示表情符号。

网站 http://yacd.metacubex.one 是通过 HTTP 提供服务的，而不是 HTTPS，因为许多浏览器会阻止从 HTTPS 网站请求 HTTP 资源。如果认为这不安全，可以下载[gh-pages 的 zip 文件](https://github.com/MetaCubeX/yacd/archive/gh-pages.zip)，解压缩并使用 Web 服务器（如 Nginx）提供这些静态文件。

**支持的 URL 查询参数**

| 参数     | 描述                                                               |
| -------- | ------------------------------------------------------------------ |
| hostname | Clash 后端 API 的主机名（通常是`external-controller`的 host 部分） |
| port     | Clash 后端 API 的端口号（通常是`external-controller`的 port 部分） |
| secret   | Clash API 密钥（`config.yaml`中的"secret"）                        |
| theme    | UI 颜色方案（dark、light、auto）                                   |

## 开发部署

```sh
# 安装依赖库
# 你可以从 https://bun.sh 安装 bun
bun install

 # 启动开发服务器
 # 然后访问 http://127.0.0.1:3000
 bun start

 # 构建优化资源
 # 准备好部署的资源将在目录 `public` 中
 bun run build
```

## 局域网部署（面板 + 同源反代）

面板本身没有后端，"部署"就是把 `bun run build` 的产物交给一个静态服务。如果只在本机用，任意静态服务器都可以；但要让**局域网内多台设备**都能访问、又不必每台都处理 CORS，最省事的做法是：把面板放在一台常开主机上（比如一台 Armbian 小主机），**让它同时充当静态服务器与内核 API 的反向代理**。这样浏览器只跟一个来源通信，天然同源、无需 CORS，也不需要终端窗口常驻。

    浏览器 → 面板主机:端口
             ├── /                     → 面板静态文件
             └── /version /proxies …   → 反向代理 → 内核 external-controller

### 步骤

1. 构建：`bun run build`，产物在 `public/`。
2. 把 `public/` 拷到面板主机上，例如 `/var/www/yacd`。
3. 安装 nginx，新建站点配置 `/etc/nginx/sites-available/yacd`（端口别和其他服务冲突）：

   ```nginx
   server {
       listen 8080;
       server_name _;

       root /var/www/yacd;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # 内核接口 + WebSocket，反向代理，使浏览器只与本来源通信
       location ~ ^/(version|configs|proxies|group|providers|rules|connections|traffic|logs|memory|restart|upgrade|cache)(/|$) {
           proxy_pass http://<内核主机IP>:<控制器端口>;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection $connection_upgrade;
           proxy_read_timeout 3600s;
           proxy_send_timeout 3600s;
       }
   }
   ```

   WebSocket 需要下面这个映射，放在 `/etc/nginx/conf.d/upgrade.conf`：

   ```nginx
   map $http_upgrade $connection_upgrade {
       default upgrade;
       ''      close;
   }
   ```

   然后：`ln -s /etc/nginx/sites-available/yacd /etc/nginx/sites-enabled/`；移除发行版自带的默认站点（否则它会抢占 80 端口）；最后 `nginx -t && systemctl enable --now nginx`。

4. 让内核的控制器在局域网可达：
   - 直接把控制器绑到局域网，例如 `external-controller: 0.0.0.0:9097`，并保留 `secret`；
   - 若客户端把控制器固定在 `127.0.0.1`（Clash Verge Rev 就是如此），可在 Windows 上加一条端口转发，再把上面的 `proxy_pass` 指向该端口：

     ```
     netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=9098 connectaddress=127.0.0.1 connectport=9097
     ```

5. 局域网内任意设备打开 `http://<面板主机>:<端口>/`，填一次 secret 即可（后端地址会自动探测并填好）。

### 注意

- 这等于把 Clash 控制器暴露到局域网，**仅在可信网络**下使用，secret 要足够强。
- 面板是纯静态 SPA（hash 路由），服务器只需把未知路径回退到 `index.html`。
- 更新面板：重新 `bun run build` 后覆盖静态目录即可，通常无需重启。
- 回滚：停用/删除该 nginx 站点，并执行 `netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=9098`。

### 关于内核直接托管 UI（external-ui）

mihomo 支持用 `external-ui` 直接托管面板（同源、无需反代）。但在 Clash Verge Rev 上不稳定：服务模式下 Verge 会自己接管 `/ui`（提供内置 MetaCubeXD）并覆盖你的 `external-ui`；而把 `external-ui` 指向数据目录之外的绝对路径，还会直接导致内核启动失败。因此本仓库采用上面的反向代理方案，而不是 `external-ui`。

## 开发时的替代方案

`vite.config.mts` 内置了同源反向代理：`bun start`（或 `bun serve`）会把 `/version`、`/proxies`、`/configs` 等内核接口转发到 `http://127.0.0.1:9097`（可用环境变量 `CLASH_API_TARGET` 覆盖目标）。此时面板后端填 `127.0.0.1:3000` 即可，同样不需要 CORS 白名单。
