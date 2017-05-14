require("use-strict");
const port = 9991;
new (require("./Server.js"))(port).start();
