const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'messages.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

// 启动时确保 messages.json 存在，不存在就自动创建
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
    console.log('已自动创建 messages.json');
  }
}

function readMessages() {
  ensureDataFile();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

function writeMessages(messages) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

function formatTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
  );
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    sendJSON(res, 204, {});
    return;
  }

  // GET /messages —— 返回所有留言
  if (req.method === 'GET' && pathname === '/messages') {
    sendJSON(res, 200, readMessages());
    return;
  }

  // POST /messages —— 新增一条留言
  if (req.method === 'POST' && pathname === '/messages') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const name = String(data.name || '').trim();
        const content = String(data.content || '').trim();

        if (!name || !content) {
          sendJSON(res, 400, { error: '昵称和留言内容不能为空' });
          return;
        }
        if (name.length > 30 || content.length > 500) {
          sendJSON(res, 400, { error: '昵称最多 30 字，留言最多 500 字' });
          return;
        }

        const messages = readMessages();
        const message = {
          name: name,
          content: content,
          time: formatTime(new Date())
        };
        messages.push(message);
        writeMessages(messages);

        sendJSON(res, 201, message);
      } catch (err) {
        sendJSON(res, 400, { error: '请求格式不正确' });
      }
    });
    return;
  }

  // 静态文件：直接访问 http://localhost:3000 就能打开页面
  if (req.method === 'GET') {
    const filePath = pathname === '/'
      ? path.join(__dirname, 'index.html')
      : path.join(__dirname, pathname);

    const rel = path.relative(__dirname, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      sendJSON(res, 403, { error: 'Forbidden' });
      return;
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        sendJSON(res, 404, { error: 'Not Found' });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
    return;
  }

  sendJSON(res, 405, { error: 'Method Not Allowed' });
});

ensureDataFile();
server.listen(PORT, () => {
  console.log('留言板服务器已启动：http://localhost:' + PORT);
});
