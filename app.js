require("use-strict");
const os = require("os");
const port = 9991;
new (require("./Server.js"))(port).start();
console.log(`Server address to dump data into: http://${os.hostname}:${port}\nServer adress to receive dumped data via websockets: http://${os.hostname}:${port + 1}`);
