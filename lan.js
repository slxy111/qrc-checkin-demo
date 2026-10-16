/* 用 file:// 直接打开时用这个占位文件（不会报错）；
   通过「启动服务器.cmd」打开时，服务器会返回真实的局域网 IP。 */
window.__LAN_IP = window.__LAN_IP || null;
window.__HAS_API = window.__HAS_API || false;   // 静态托管（如 GitHub Pages）下没有共享接口
