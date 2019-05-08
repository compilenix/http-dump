# Donate if you want
https://www.paypal.me/compilenix

http-dump
========
[![Known Vulnerabilities](https://snyk.io/test/github/compilenix/http-dump/badge.svg?targetFile=package.json)](https://snyk.io/test/github/compilenix/http-dump?targetFile=package.json) [![Greenkeeper badge](https://badges.greenkeeper.io/compilenix/http-dump.svg)](https://greenkeeper.io/)

when you have to debug stuff and cannot get easy data out of the system, but a simple http cient is available.

dump stuff to console or webclient (using websocket).

requirements
--------------------

a random server with:
 - git
 - NodeJs

```sh
npm start
```

usage
--------------------

now you can send (http POST) stuff to the server's address on port 9991.

everything will be logged to console and all connected web clients (http GET on port 9992).
