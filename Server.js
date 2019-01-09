const querystring = require('querystring')
const http = require('http')
const { URL } = require('url')
const fs = require('fs')
const zlib = require('zlib')
const os = require('os')

const WebSocketServer = require('ws').Server
const htmlencode = require('htmlencode').htmlEncode // TODO: it's fine...

const cache = [{
  path: 'robots.txt',
  content: fs.readFileSync('./robots.txt', 'utf8'),
  content_type: 'text/plain',
  status_code: 200,
  length: 0,
  content_gzip: null,
  content_gzip_length: 0,
  content_deflate: null,
  content_deflatelength: 0
},
{
  path: 'index.html',
  content: fs.readFileSync('./index.html', 'utf8'),
  content_type: 'text/html',
  status_code: 200,
  length: 0,
  content_gzip: null,
  content_gzip_length: 0,
  content_deflate: null,
  content_deflatelength: 0
},
{
  path: 'jquery.min.js',
  content: fs.readFileSync('./jquery.min.js', 'utf8'),
  content_type: 'application/javascript',
  status_code: 200,
  length: 0,
  content_gzip: null,
  content_gzip_length: 0,
  content_deflate: null,
  content_deflatelength: 0
}
]

cache.forEach(element => {
  const contentBuffer = Buffer.from(element.content)
  element.length = Buffer.byteLength(element.content, 'utf8')
  element.content_gzip = zlib.gzipSync(contentBuffer, {
    level: zlib.Z_BEST_COMPRESSION,
    memLevel: 9,
    flush: zlib.Z_NO_FLUSH
  })
  element.content_gzip_length = Buffer.byteLength(element.content_gzip)
  element.content_deflate = zlib.deflateSync(contentBuffer, {
    level: zlib.Z_BEST_COMPRESSION,
    memLevel: 9,
    flush: zlib.Z_NO_FLUSH
  })
  element.content_deflate_length = Buffer.byteLength(element.content_deflate)
})

let clients = []
let port = 0

class Server {
  /**
   * Creates an instance of Server.
   * @param {number} portBind
   * @memberof Server
   */
  constructor (portBind) {
    port = portBind
    this.socketServer = null
    this.socket = null
  }

  start () {
    http.createServer(Server.onRequest).listen(port)
    this.socketServer = http.createServer(Server.onRequestSocketServer)
    this.socketServer.listen(port + 1)
    this.socket = new WebSocketServer({
      server: this.socketServer
    })

    this.socket.on('connection', ws => {
      clients.push(ws)

      ws.on('close', () => {
        ws.close()
      })
    })
  }

  static onRequestSocketServer (request, response) {
    const url = new URL(request.url, `http://${os.hostname}:${port}`)

    let returns = false
    cache.forEach(element => {
      if (url.pathname === `/${element.path}`) {
        Server.sendResponse(request, response, element)
        returns = true
      }
    })

    if (returns) return

    Server.sendResponse(request, response, {
      status_code: 302,
      content: 'Moved',
      location: '/index.html'
    })
  }

  /**
    * @static
    * @param {http.IncomingMessage} request
    * @param {any} data
    * @memberof Server
    */
  static debugOut (request, data) {
    let stuff = {
      Date: new Date(),
      Method: htmlencode(request.method),
      RequestUrl: htmlencode(request.url),
      Data: htmlencode(data)
    }
    let stuffString = JSON.stringify(stuff)

    // eslint-disable-next-line no-console
    console.log(`Date: ${new Date()}\n${request.method}: ${request.url}\nHeaders: ${JSON.stringify(request.headers)}\nData: ${data}\n`)

    clients.forEach(ws => {
      if (ws.OPEN !== 1) {
        return
      }

      ws.send(stuffString, () => { /* ignore errors */ })
    })
  }

  /**
   * @static
   * @param {http.IncomingMessage} request
   * @param {http.ServerResponse} response
   * @param {any} element
   * @memberof Server
   */
  static sendResponse (request, response, element) {
    /** @type {any} */
    let data
    const contentBuffer = Buffer.from(element.content || '')
    element.length = Buffer.byteLength(element.content, 'utf8')
    element.content_gzip = zlib.gzipSync(contentBuffer, {
      level: zlib.Z_BEST_COMPRESSION,
      memLevel: 9,
      flush: zlib.Z_NO_FLUSH
    })
    element.content_gzip_length = Buffer.byteLength(element.content_gzip)
    element.content_deflate = zlib.deflateSync(contentBuffer, {
      level: zlib.Z_BEST_COMPRESSION,
      memLevel: 9,
      flush: zlib.Z_NO_FLUSH
    })
    element.content_deflate_length = Buffer.byteLength(element.content_deflate)

    // TODO: implement proper content-encoding
    if (Array.isArray(request.headers['accept-encoding'])) {
      response.writeHead(element.status_code || 500)
      response.end(data || '')
      return
    }

    if (request.headers['accept-encoding']) { // if accept-encoding
      if (request.headers['accept-encoding'].match(/\bgzip\b/)) { // if accepting gzip // TODO: implement proper content-encoding
        if (element.content_gzip && element.content_gzip_length > 0) { // if has gzip
          response.setHeader('Vary', 'Accept-Encoding')
          response.setHeader('Content-Encoding', 'gzip')
          response.setHeader('Content-Length', element.content_gzip_length)
          data = element.content_gzip
        } else { // if NOT has gzip
          response.setHeader('Content-Length', element.length)
          data = element.content
        }
      } else if (request.headers['accept-encoding'].match(/\bdeflate\b/)) { // if accepting deflate // TODO: implement proper content-encoding
        if (element.content_deflate && element.content_deflate_length > 0) { // if has deflate
          response.setHeader('Vary', 'Accept-Encoding')
          response.setHeader('Content-Encoding', 'deflate')
          response.setHeader('Content-Length', element.content_deflate_length)
          data = element.content_deflate
        } else { // if NOT has deflate
          response.setHeader('Content-Length', element.length)
          data = element.content
        }
      } else { // if NOT accepting gzip AND NOT accepting deflate
        response.setHeader('Content-Length', element.length)
        data = element.content
      }
    } else { // if NOT accept-encoding
      response.setHeader('Content-Length', element.length)
      data = element.content
    }

    response.setHeader('Content-Type', element.content_type || 'text/plain')
    response.setHeader('Connection', 'close')
    response.removeHeader('Date')

    if (element.status_code === 302) {
      response.setHeader('Location', '/index.html')
    }

    response.writeHead(element.status_code || 500)
    response.end(data || '')
  }

  /**
   * @static
   * @param {http.IncomingMessage} request
   * @param {http.ServerResponse} response
   * @returns
   * @memberof Server
   */
  static onRequest (request, response) {
    const url = new URL(request.url, `http://${os.hostname}:${port}`)

    let returns = false
    cache.forEach(element => {
      if (url.pathname === `/${element.path}`) {
        Server.sendResponse(request, response, element)
        returns = true
      }
    })

    if (returns) return

    let requestHasPayload = false
    let requestPayload = ''
    switch (request.method) {
      case 'PUT':
      case 'POST':
        requestHasPayload = true
        request.on('data', postData => {
          if (requestPayload.length + postData.length < 1e6) { // ~1 Megabyte
            requestPayload += postData
          } else {
            Server.debugOut(request, 'Request entity too large')
            Server.sendResponse(request, response, {
              status_code: 413,
              content: 'Request entity too large'
            })
          }
        })

        request.on('end', () => {
          switch (request.headers['content-type']) {
            case 'application/x-www-form-urlencoded':
              requestPayload = querystring.unescape(requestPayload)
              break
          }

          Server.sendResponse(request, response, {
            status_code: 200,
            content: 'OK'
          })
          Server.debugOut(request, requestPayload)
        })
        break

      case 'HEAD':
      case 'GET':
        Server.debugOut(request, null)
        break

      default:
        Server.debugOut(request, null)
        Server.sendResponse(request, response, {
          status_code: 501,
          content: 'Not Implemented'
        })
        return
    }

    if (!requestHasPayload) {
      Server.sendResponse(request, response, {
        status_code: 200,
        content: 'OK'
      })
    }
  }
}

module.exports = Server
