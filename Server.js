const querystring = require("querystring");
const http = require("http");
const url = require("url");
const fs = require("fs");
const zlib = require("zlib");
const WebSocketServer = require('ws').Server;

const cache = [
	{
		path: "robots.txt",
		content: fs.readFileSync("./robots.txt", "utf8"),
		content_type: "text/plain",
		status_code: 200,
		length: 0,
		content_gzip: null,
		content_gzip_length: 0,
		content_deflate: null,
		content_deflatelength: 0
	},
	{
		path: "index.html",
		content: fs.readFileSync("./index.html", "utf8"),
		content_type: "text/html",
		status_code: 200,
		length: 0,
		content_gzip: null,
		content_gzip_length: 0,
		content_deflate: null,
		content_deflatelength: 0
	},
	{
		path: "jquery.min.js",
		content: fs.readFileSync("./jquery.min.js", "utf8"),
		content_type: "application/javascript",
		status_code: 200,
		length: 0,
		content_gzip: null,
		content_gzip_length: 0,
		content_deflate: null,
		content_deflatelength: 0
	}
];

cache.forEach((element) => {
	const contentBuffer = new Buffer(element.content);
	element.length = Buffer.byteLength(element.content, "utf8");
	element.content_gzip = zlib.gzipSync(contentBuffer, { level: zlib.Z_BEST_COMPRESSION, memLevel: 9, flush: zlib.Z_NO_FLUSH });
	element.content_gzip_length = Buffer.byteLength(element.content_gzip);
	element.content_deflate = zlib.deflateSync(contentBuffer, { level: zlib.Z_BEST_COMPRESSION, memLevel: 9, flush: zlib.Z_NO_FLUSH });
	element.content_deflate_length = Buffer.byteLength(element.content_deflate);
});

let clients = [];

class Server {

	/**
	 * Creates an instance of Server.
	 * @param {number} port
	 * @memberof Server
	 */
	constructor(port) {
		this.port = port;
		this.socketServer = null;
		this.socket = null;
	}

	start() {
		http.createServer(Server.onRequest).listen(this.port);
		this.socketServer = http.createServer(Server.onRequestSocketServer);
		this.socketServer.listen(this.port + 1);
		this.socket = new WebSocketServer({server: this.socketServer});

		this.socket.on('connection', (ws) => {
			clients.push(ws);

			ws.on('close', () => {
				ws.close();
			});
		});

		return;
	}

	static onRequestSocketServer(request, response) {
		Server.debugOut(request, null);
		const queryPath = url.parse(request.url).path;

		let returns = false;
		cache.forEach((element) => {
			if (queryPath === `/${element.path}`) {
				Server.sendResponse(request, response, element);
				returns = true;
			}
		});

		if (returns) return;

		Server.sendResponse(request, response, {
			status_code: 404,
			content: "Not Found"
		});

		return;
	}

	/**
	 * @static
	 * @param {http.IncomingMessage} request
	 * @param {any} data
	 * @memberof Server
	 */
	static debugOut(request, data) {
		let stuff = {
			Date: new Date(),
			Method: request.method,
			RequestUrl: request.url,
			Data: data
		};
		let stuffString = JSON.stringify(stuff);

		// eslint-disable-next-line no-console
		console.log("Date: " + new Date() + "\n"
			+ request.method + ": " + request.url + "\n"
			+ "Headers: " + JSON.stringify(request.headers) + "\n"
			+ "Data: " + data
			+ "\n");

		clients.forEach((ws) => {
			if (ws.OPEN !== 1) {
				return;
			}

			ws.send(stuffString, () => { /* ignore errors */ });
		});
	}

	/**
	 * @static
	 * @param {http.IncomingMessage} request
	 * @param {http.ServerResponse} response
	 * @param {any} element
	 * @memberof Server
	 */
	static sendResponse(request, response, element) {
		/** @type {any} */
		let data;
		const contentBuffer = new Buffer(element.content);
		element.length = Buffer.byteLength(element.content, "utf8");
		element.content_gzip = zlib.gzipSync(contentBuffer, { level: zlib.Z_BEST_COMPRESSION, memLevel: 9, flush: zlib.Z_NO_FLUSH });
		element.content_gzip_length = Buffer.byteLength(element.content_gzip);
		element.content_deflate = zlib.deflateSync(contentBuffer, { level: zlib.Z_BEST_COMPRESSION, memLevel: 9, flush: zlib.Z_NO_FLUSH });
		element.content_deflate_length = Buffer.byteLength(element.content_deflate);

		if (request.headers["accept-encoding"]) { // if accept-encoding
			if (request.headers["accept-encoding"].match(/\bgzip\b/)) { // if accepting gzip
				if (element.content_gzip && element.content_gzip_length > 0) { // if has gzip
					response.setHeader("Vary", "Accept-Encoding");
					response.setHeader("Content-Encoding", "gzip");
					response.setHeader("Content-Length", element.content_gzip_length);
					data = element.content_gzip;
				} else { // if NOT has gzip
					response.setHeader("Content-Length", element.length);
					data = element.content;
				}
			} else if (request.headers["accept-encoding"].match(/\bdeflate\b/)) { // if accepting deflate
				if (element.content_deflate && element.content_deflate_length > 0) { // if has deflate
					response.setHeader("Vary", "Accept-Encoding");
					response.setHeader("Content-Encoding", "deflate");
					response.setHeader("Content-Length", element.content_deflate_length);
					data = element.content_deflate;
				} else { // if NOT has deflate
					response.setHeader("Content-Length", element.length);
					data = element.content;
				}
			} else { // if NOT accepting gzip AND NOT accepting deflate
				response.setHeader("Content-Length", element.length);
				data = element.content;
			}
		} else { // if NOT accept-encoding
			response.setHeader("Content-Length", element.length);
			data = element.content;
		}

		response.setHeader("Content-Type", element.content_type || "text/plain");
		response.setHeader("Connection", "close");
		response.removeHeader("Date");
		response.writeHead(element.status_code || 500);
		response.end(data || "");
		return;
	}

	/**
	 * @static
	 * @param {http.IncomingMessage} request
	 * @param {http.ServerResponse} response
	 * @returns
	 * @memberof Server
	 */
	static onRequest(request, response) {
		const queryPath = url.parse(request.url).path;

		let returns = false;
		cache.forEach((element) => {
			if (queryPath === `/${element.path}`) {
				Server.sendResponse(request, response, element);
				return;
			}
		});

		if (returns) return;

		if (request.method === "POST") {
			let body = "";

			request.on("data", (postData) => {
				// reading http POST body
				if (body.length + postData.length < 5e7) { // // 50 Megabyte
					body += postData;
				} else {
					Server.debugOut(request, "Request entity too large");
					Server.sendResponse(request, response, {
						status_code: 413,
						content: "Request entity too large"
					});
					return;
				}
			});

			request.on("end", () => {
				switch(request.headers["content-type"]) {
					case "application/x-www-form-urlencoded":
						body = querystring.unescape(body);
						break;
				}

				Server.debugOut(request, body);
			});
		} else if (request.method === "GET") {
			Server.debugOut(request, null);
		} else {
			Server.debugOut(request, null);
			Server.sendResponse(request, response, {
				status_code: 501,
				content: "Not Implemented"
			});
			return;
		}

		Server.sendResponse(request, response, {
			status_code: 200,
			content: "OK"
		});

		return;
	}
}

module.exports = Server;
