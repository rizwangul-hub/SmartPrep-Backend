// backend/src/server.js
const http = require('http');
const app = require('./app');
const DEFAULT_PORT = 5000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

const server = http.createServer(app);

function onListening(port) {
  console.log(`🚀 Server listening on port ${port}`);
}

let attempts = 0;
function start() {
  server.listen(PORT + attempts, () => onListening(PORT + attempts));
}
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && attempts < 10) {
    console.warn(`Port ${PORT + attempts} in use, trying ${PORT + attempts + 1}...`);
    attempts += 1;
    start();
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
start();
