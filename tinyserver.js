const net = require('net');

net.createServer(socket => {
  socket.write("HELLO\r\n");
  socket.end();
}).listen(9005, () => console.log("raw tcp on 9005"));
