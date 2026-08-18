const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.raw({ type: '*/*', limit: '10mb' }));

// Route API requests to PHP scripts using PHP-WASM
app.all(['/backend/api/:file', '/api/:file'], (req, res) => {
  const fileName = req.params.file.endsWith('.php') ? req.params.file : `${req.params.file}.php`;
  const phpFilePath = path.join(__dirname, 'backend', 'api', fileName);

  if (!fs.existsSync(phpFilePath)) {
    return res.status(404).json({ success: false, message: 'API Endpoint not found' });
  }

  const queryString = new URLSearchParams(req.query).toString();
  const env = {
    ...process.env,
    REQUEST_METHOD: req.method,
    QUERY_STRING: queryString,
    CONTENT_TYPE: req.headers['content-type'] || 'application/json',
    CONTENT_LENGTH: req.body ? req.body.length : 0,
    SCRIPT_FILENAME: phpFilePath
  };

  const phpProcess = spawn('npx', ['-y', '@php-wasm/cli', phpFilePath], {
    env,
    cwd: __dirname
  });

  let stdout = '';
  let stderr = '';

  if (req.body && req.body.length > 0) {
    phpProcess.stdin.write(req.body);
  }
  phpProcess.stdin.end();

  phpProcess.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  phpProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  phpProcess.on('close', (code) => {
    // Parse PHP header/body separator if present
    let statusCode = 200;
    let body = stdout;
    let contentType = 'application/json';

    const headerEndIndex = stdout.indexOf('\r\n\r\n');
    if (headerEndIndex !== -1) {
      const headersRaw = stdout.substring(0, headerEndIndex);
      body = stdout.substring(headerEndIndex + 4);

      headersRaw.split('\r\n').forEach(headerLine => {
        const [key, ...valueParts] = headerLine.split(':');
        if (key && valueParts.length) {
          const val = valueParts.join(':').trim();
          if (key.toLowerCase() === 'content-type') {
            contentType = val;
          } else if (key.toLowerCase() === 'status' || key.toLowerCase() === 'http/1.1') {
            const codeMatch = val.match(/\d{3}/);
            if (codeMatch) statusCode = parseInt(codeMatch[0]);
          }
        }
      });
    } else {
      // Look for http_response_code in output or standard JSON
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.errors) statusCode = 422;
      } catch (e) {}
    }

    res.status(statusCode).set('Content-Type', contentType).send(body);
  });
});

// Serve static files from root and frontend
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve index.html for root route
app.get('/', (req, res) => {
  if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  }
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`\n==================================================`);
    console.log(`  Purchase Management ERP Server Running!`);
    console.log(`  Local URL: http://localhost:${port}`);
    console.log(`==================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port Warning] Port ${port} is currently in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
