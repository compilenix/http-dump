require("use-strict");
const port = 80;
new (require("./Server.js"))(port).start();
