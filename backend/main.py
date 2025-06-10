import os
import json
import uuid
import hashlib
from flask import Flask, request, jsonify, abort, send_from_directory
from flask_cors import CORS
import jwt
import datetime

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
USERS_FILE = os.path.join(DATA_DIR, 'users.json')
JWT_SECRET = 'KS54_SECRET_PRACTICS'
JWT_ALG = 'HS256'

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

def read_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hashed):
    return hash_password(password) == hashed

def create_token(user):
    payload = {
        'username': user['username'],
        'id': user['id'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return None

def auth_required(f):
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization')
        if not auth or not auth.startswith('Bearer '):
            abort(401, 'No token')
        token = auth.split(' ')[1]
        payload = decode_token(token)
        if not payload:
            abort(401, 'Invalid token')
        request.user = payload
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return 'Missing credentials', 400

    users = read_users()
    if any(u['username'] == username for u in users.values()):
        return 'User exists', 409

    user_id = str(uuid.uuid4())
    hashed = hash_password(password)
    users[user_id] = {'id': user_id, 'username': username, 'password': hashed}
    write_users(users)

    user_dir = os.path.join(DATA_DIR, user_id)
    if not os.path.exists(user_dir):
        os.makedirs(user_dir)

    return 'Registered', 200

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return 'Missing credentials', 400

    users = read_users()
    user = next((u for u in users.values() if u['username'] == username), None)
    if not user or not verify_password(password, user['password']):
        return 'Invalid credentials', 401

    token = create_token(user)
    return jsonify({'token': token})

@app.route('/data', methods=['GET'])
@auth_required
def list_files():
    user_dir = os.path.join(DATA_DIR, request.user['id'])
    if not os.path.exists(user_dir):
        return jsonify([])
    files = [f for f in os.listdir(user_dir) if f.endswith('.json')]
    return jsonify(files)

@app.route('/data/<filename>', methods=['GET'])
@auth_required
def get_file(filename):
    user_dir = os.path.join(DATA_DIR, request.user['id'])
    file_path = os.path.join(user_dir, filename)
    if not os.path.exists(file_path):
        return 'Файл не найден', 404
    with open(file_path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/data/<filename>', methods=['POST'])
@auth_required
def save_file(filename):
    user_dir = os.path.join(DATA_DIR, request.user['id'])
    if not os.path.exists(user_dir):
        os.makedirs(user_dir)
    file_path = os.path.join(user_dir, filename)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(request.get_json(), f, ensure_ascii=False, indent=2)
    return 'OK', 200

@app.route('/data/<filename>', methods=['DELETE'])
@auth_required
def delete_file(filename):
    user_dir = os.path.join(DATA_DIR, request.user['id'])
    file_path = os.path.join(user_dir, filename)
    if not os.path.exists(file_path):
        return 'Файл не найден', 404
    os.remove(file_path)
    return 'Удалено', 200

if __name__ == '__main__':
    app.run(port=3000)