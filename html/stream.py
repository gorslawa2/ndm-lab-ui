import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

LOG_FILE = '/host_logs/hop_events.log'

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        
        if parsed.path == '/api/logs':
            params = parse_qs(parsed.query)
            since = int(params.get('since', [0])[0])
            
            try:
                if not os.path.exists(LOG_FILE):
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"lines": [], "newSize": 0}).encode())
                    return
                
                current_size = os.path.getsize(LOG_FILE)
                
                if current_size < since:
                    since = 0
                
                with open(LOG_FILE, 'r') as f:
                    f.seek(since)
                    new_content = f.read()
                
                lines = [line.strip() for line in new_content.split('\n') if line.strip()]
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "lines": lines,
                    "newSize": current_size
                }).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        
        self.send_response(404)
        self.end_headers()
    
    def log_message(self, *args):
        pass

if __name__ == '__main__':
    print(f"[API] Started on port 8086", file=sys.stderr, flush=True)
    HTTPServer(('0.0.0.0', 8086), APIHandler).serve_forever()
