# Pairing relay: install on the VPS

The relay passes end-to-end encrypted messages between a desktop and its paired
phone/tablet. It stores nothing and cannot read scripts.

## 1. Install (as root, one time)

```bash
mkdir -p /opt/space-prompter-relay && cd /opt/space-prompter-relay
curl -sSL -H "Accept: application/vnd.github.raw+json" -o server.js  "https://api.github.com/repos/shovonix/space-teleprompter/contents/relay/server.js?ref=main"
curl -sSL -H "Accept: application/vnd.github.raw+json" -o package.json "https://api.github.com/repos/shovonix/space-teleprompter/contents/relay/package.json?ref=main"
# no npm install needed: the relay has zero dependencies (needs Node 18+: apt install -y nodejs)
useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin spacerelay
chown -R spacerelay:spacerelay /opt/space-prompter-relay
```

## 2. Run it as a service

`/etc/systemd/system/space-prompter-relay.service`:

```ini
[Unit]
Description=Space Prompter pairing relay
After=network.target

[Service]
User=spacerelay
WorkingDirectory=/opt/space-prompter-relay
Environment=PORT=8787
Environment=ALLOWED_ORIGINS=https://prompter.shovonix.dev,https://shovonix.dev
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now space-prompter-relay
curl -s http://127.0.0.1:8787/healthz   # should print: ok
```

## 3. Route /relay through nginx

CloudPanel: Sites > prompter.shovonix.dev > Vhost, add inside the `server { ... }` block:

```nginx
location /relay {
  proxy_pass http://127.0.0.1:8787;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 3600s;
}
```

Save, then `nginx -t && systemctl reload nginx`.

Limits built in: 4 devices per room, 500 rooms, 512 KB per message, rate limit, origin check.
