// Space Prompter pairing relay (zero dependencies, Node 18+).
// Passes opaque, end-to-end encrypted messages between devices that share a
// room id. It never stores anything and cannot read scripts: the encryption
// key lives only in the QR link's #fragment, which browsers never send.
//
//   PORT=8787 node server.js
//
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://prompter.shovonix.dev,http://localhost:8099,http://127.0.0.1:8099').split(',');
const MAX_MSG = 512 * 1024;      // bytes per message
const MAX_PEERS = 4;             // host + up to 3 phones/tablets per room
const MAX_ROOMS = 500;
const IDLE_MS = 30 * 60 * 1000;  // drop a silent connection after 30 min
const RATE_MAX = 80;             // messages per second per socket
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const rooms = new Map(); // roomId -> Set<client>

function frame(opcode, payload) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  res.writeHead(404); res.end();
});

function reject(socket, line) { socket.write('HTTP/1.1 ' + line + '\r\nConnection: close\r\n\r\n'); socket.destroy(); }

server.on('upgrade', (req, socket) => {
  const origin = req.headers.origin || '';
  if (ALLOWED.indexOf(origin) === -1) return reject(socket, '403 Forbidden');
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') return reject(socket, '400 Bad Request');
  const room = new URL(req.url, 'http://x').searchParams.get('room') || '';
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(room)) return reject(socket, '400 Bad Request');
  let set = rooms.get(room);
  if (!set && rooms.size >= MAX_ROOMS) return reject(socket, '503 Service Unavailable');
  if (set && set.size >= MAX_PEERS) return reject(socket, '409 Conflict');

  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);

  if (!set) { set = new Set(); rooms.set(room, set); }
  const c = { socket, room, alive: true, last: Date.now(), win: Date.now(), count: 0, buf: Buffer.alloc(0), frag: [], fragOp: 0, fragLen: 0, closed: false };
  set.add(c);

  const leave = () => {
    if (c.closed) return; c.closed = true;
    const s = rooms.get(room); if (s) { s.delete(c); if (!s.size) rooms.delete(room); }
    socket.destroy();
  };
  socket.on('close', leave);
  socket.on('error', leave);
  socket.on('data', (chunk) => {
    c.buf = Buffer.concat([c.buf, chunk]);
    if (c.buf.length > MAX_MSG * 2) return leave();
    try { parse(); } catch (e) { leave(); }
  });

  function relay(op, payload) {
    const now = Date.now();
    if (now - c.win > 1000) { c.win = now; c.count = 0; }
    if (++c.count > RATE_MAX) return; // drop floods silently
    c.last = now;
    const out = frame(op, payload);
    const peers = rooms.get(room); if (!peers) return;
    for (const p of peers) if (p !== c && !p.closed) p.socket.write(out);
  }

  function parse() {
    for (;;) {
      const b = c.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(MAX_MSG)) return leave(); len = Number(big); off = 10; }
      if (!masked) return leave(); // clients must mask
      if (len > MAX_MSG) return leave();
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4);
      const data = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      c.buf = b.subarray(off + 4 + len);
      if (op === 0x8) { socket.write(frame(0x8, Buffer.alloc(0))); return leave(); }
      if (op === 0x9) { socket.write(frame(0xA, data)); continue; }
      if (op === 0xA) { c.alive = true; continue; }
      if (op === 0x1 || op === 0x2) {
        if (fin) relay(op, data);
        else { c.fragOp = op; c.frag = [data]; c.fragLen = data.length; }
      } else if (op === 0x0) {
        c.frag.push(data); c.fragLen += data.length;
        if (c.fragLen > MAX_MSG) return leave();
        if (fin) { relay(c.fragOp, Buffer.concat(c.frag)); c.frag = []; c.fragLen = 0; }
      }
    }
  }
});

setInterval(() => {
  const now = Date.now();
  for (const set of rooms.values()) for (const c of set) {
    if (c.closed) continue;
    if (!c.alive || now - c.last > IDLE_MS) { c.socket.destroy(); continue; }
    c.alive = false; c.socket.write(frame(0x9, Buffer.alloc(0)));
  }
}, 20000);

server.listen(PORT, '127.0.0.1', () => console.log('space-prompter relay on 127.0.0.1:' + PORT));
