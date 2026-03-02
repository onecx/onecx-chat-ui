const bypassFn = function (req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'GET, POST, HEAD, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      return res.send('');
    } else {
      return null;
    }
  } catch (error) {
    console.log('error', error);
  }
};

const PROXY_CONFIG = {
  '/bff': {
    target: 'http://onecx-chat-bff',
    secure: false,
    pathRewrite: {
      '^.*/bff': '',
    },
    changeOrigin: true,
    logLevel: 'debug',
    bypass: bypassFn,
  },
  '/mfe/onecx-chat': {
    target: 'http://localhost:4200/',
    secure: false,
    pathRewrite: {
      '^.*/mfe/onecx-chat': '',
    },
    changeOrigin: true,
    logLevel: 'debug',
    bypass: bypassFn,
  },
  '/voice-bff': {
    target: 'http://localhost:7860',
    secure: false,
    pathRewrite: {
      '^.*/voice-bff': '',
    },
    changeOrigin: true,
    logLevel: 'debug',
    ws: true,
    bypass: bypassFn,
  }
};

module.exports = PROXY_CONFIG;
