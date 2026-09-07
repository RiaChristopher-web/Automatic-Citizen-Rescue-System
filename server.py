from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json

HOST = '0.0.0.0'
PORT = 8000

class ACRSHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/api/event':
            self.send_error(404, 'Not Found')
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length) if length else b'{}'
            data = json.loads(body.decode('utf-8'))
            response = {'ok': True, 'received': data}
            raw = json.dumps(response).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(raw)
        except Exception as exc:
            self.send_error(400, f'Invalid JSON: {exc}')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    print(f'ACRS running locally at http://localhost:{PORT}')
    print(f'Public with ngrok: ngrok http {PORT}')
    ThreadingHTTPServer((HOST, PORT), ACRSHandler).serve_forever()
