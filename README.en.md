**Download the build**: <https://venniel.github.io/Yacd-meta/download/yacd-dashboard.zip>. Unzip it and serve the files with any static web server.

> Forked from [MetaCubeX/Yacd-meta](https://github.com/MetaCubeX/Yacd-meta), with some accessibility (screen reader) improvements on top.

> Yet Another [Clash](https://github.com/yaling888/clash) [Dashboard](https://github.com/yaling888/clash-dashboard)

[中文](./README.md)

## Usage

Install [twemoji](https://github.com/mozilla/twemoji-colr/releases) to display emoji better on Windows system.

The site http://yacd.metacubex.one is served with HTTP not HTTPS is because many browsers block requests to HTTP resources from a HTTPS website. If you think it's not safe, you could just download the [zip of the gh-pages](https://github.com/MetaCubeX/yacd/archive/gh-pages.zip), unzip and serve those static files with a web server(like Nginx).

**Supported URL query params**

| Param    | Description                                                                        |
| -------- | ---------------------------------------------------------------------------------- |
| hostname | Hostname of the clash backend API (usually the host part of `external-controller`) |
| port     | Port of the clash backend API (usually the port part of `external-controller`)     |
| secret   | Clash API secret (`secret` in your config.yaml)                                    |
| theme    | UI color scheme (dark, light, auto)                                                |
| title    | Custom title for the webpage (displayed in browser tab)                            |

## Development

```sh
# install dependencies
# you may install bun from https://bun.sh
bun install

# start the dev server
# then go to http://127.0.0.1:3000
bun start


# build optimized assets
# ready to deploy assets will be in the directory `public`
bun run build
```

## LAN deployment (panel + same-origin reverse proxy)

The panel has no backend of its own — "deploying" it just means serving the `bun run build` output. To use it from **multiple devices on a LAN** without dealing with CORS on each of them, the simplest setup is to host the panel on an always-on machine (e.g. a small Armbian box) and **let that machine act as both the static server and a reverse proxy for the core API**. The browser then talks to a single origin, so everything is same-origin and no CORS is involved — and no terminal window has to stay open.

    browser → panel host:port
              ├── /                     → static panel files
              └── /version /proxies …   → reverse proxy → core external-controller

### Steps

1. Build: `bun run build`; the output goes to `public/`.
2. Copy `public/` to the host, e.g. `/var/www/yacd`.
3. Install nginx and add a site config at `/etc/nginx/sites-available/yacd` (pick a port that doesn't clash with other services):

   ```nginx
   server {
       listen 8080;
       server_name _;

       root /var/www/yacd;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Core API + WebSocket, proxied so the browser only talks to this origin
       location ~ ^/(version|configs|proxies|group|providers|rules|connections|traffic|logs|memory|restart|upgrade|cache)(/|$) {
           proxy_pass http://<core-host-ip>:<controller-port>;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection $connection_upgrade;
           proxy_read_timeout 3600s;
           proxy_send_timeout 3600s;
       }
   }
   ```

   WebSocket needs this map, in `/etc/nginx/conf.d/upgrade.conf`:

   ```nginx
   map $http_upgrade $connection_upgrade {
       default upgrade;
       ''      close;
   }
   ```

   Then: `ln -s /etc/nginx/sites-available/yacd /etc/nginx/sites-enabled/`; remove the distro's default site (it would grab port 80); finally `nginx -t && systemctl enable --now nginx`.

4. Make the core controller reachable on the LAN:
   - Bind the controller to the LAN, e.g. `external-controller: 0.0.0.0:9097`, keeping `secret`;
   - If the client pins the controller to `127.0.0.1` (Clash Verge Rev does), add a port forward on Windows and point `proxy_pass` at it:

     ```
     netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=9098 connectaddress=127.0.0.1 connectport=9097
     ```

5. Open `http://<panel-host>:<port>/` from any device and enter the secret once (the backend address is auto-detected and prefilled).

### Notes

- This exposes the Clash controller to the LAN — use it on a **trusted network only** and keep a strong secret.
- The panel is a pure static SPA (hash routing); the server only needs to fall back to `index.html`.
- Updating: re-run `bun run build` and overwrite the static directory; a restart is usually unnecessary.
- Rollback: disable/remove the nginx site, and run `netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=9098`.

### About letting the core host the UI (external-ui)

mihomo can host the panel itself via `external-ui` (same origin, no proxy). On Clash Verge Rev this is unreliable: in service mode Verge takes over `/ui` (its bundled MetaCubeXD) and overrides your `external-ui`, and pointing `external-ui` at an absolute path outside the data dir makes the core fail to start. That is why this repo uses the reverse-proxy setup above instead.

## Alternative while developing

`vite.config.mts` ships a same-origin reverse proxy: `bun start` (or `bun serve`) forwards `/version`, `/proxies`, `/configs`, … to `http://127.0.0.1:9097` (override the target with the `CLASH_API_TARGET` env var). Point the panel's backend at `127.0.0.1:3000` — no CORS allow-list needed.
