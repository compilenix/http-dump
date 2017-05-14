require("use-strict");
const port = 91;
new (require("./Server.js"))(port).start();
