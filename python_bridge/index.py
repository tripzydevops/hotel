from http.server import BaseHTTPRequestHandler
import json
import datetime
import os

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {
            "status": "pong",
            "message": "Native Python Handler Active (No FastAPI)",
            "timestamp": datetime.datetime.now().isoformat(),
            "cwd": os.getcwd()
        }
        
        self.wfile.write(json.dumps(response).encode('utf-8'))
        return
