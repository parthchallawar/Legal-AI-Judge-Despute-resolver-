import os
import sqlite3
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import chromadb
from chromadb.utils import embedding_functions
from PyPDF2 import PdfReader
import openai
from dotenv import load_dotenv
from openai import OpenAI
from hashlib import sha256

# Configure paths
UPLOAD_FOLDER = "./uploads"
CHROMA_PATH = "./chroma_persistent_storage"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

load_dotenv()
client = OpenAI(api_key=os.environ['OPENAI_KEY'])
app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# SQLite database setup
DB_PATH = "users.db"

def init_db():
    """Initializes the SQLite database with a users table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

init_db()

# Helper functions
def hash_password(password):
    """Hashes a password using SHA-256."""
    return sha256(password.encode()).hexdigest()

def create_user(username, password):
    """Creates a new user in the SQLite database."""
    hashed_password = hash_password(password)
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False

def authenticate_user(username, password):
    """Authenticates a user by verifying their username and password."""
    hashed_password = hash_password(password)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, hashed_password))
    user = cursor.fetchone()
    conn.close()
    return user is not None

# Flask routes
@app.route('/signup', methods=['POST'])
def signup():
    """Registers a new user."""
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Both username and password are required"}), 400

    if create_user(username, password):
        return jsonify({"message": "Signup successful!"})
    else:
        return jsonify({"error": "Username already exists"}), 400

@app.route('/login', methods=['POST'])
def login():
    """Logs in an existing user."""
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Both username and password are required"}), 400

    if authenticate_user(username, password):
        return jsonify({"message": "Login successful!"})
    else:
        return jsonify({"error": "Invalid username or password"}), 401

# Remaining routes from your existing app
@app.route('/upload', methods=['POST'])
def upload_pdf():
    """Uploads a PDF for a user and processes it."""
    user_id = request.form.get("user_id")
    if "file" not in request.files or not user_id:
        return jsonify({"error": "Missing file or user_id"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    # Process the PDF
    text = load_pdf(filepath)
    if not text:
        return jsonify({"error": "Failed to extract text from PDF"}), 500

    # Split text into chunks
    chunks = split_text(text)
    chunked_documents = [{"id": f"{user_id}_{filename}_chunk{i+1}", "text": chunk} for i, chunk in enumerate(chunks)]

    # Add chunks to ChromaDB
    for chunk in chunked_documents:
        collection.add(
            documents=[chunk["text"]],
            metadatas=[{"user_id": user_id, "source": filename}],
            ids=[chunk["id"]]
        )

    return jsonify({"message": f"PDF '{filename}' uploaded and processed for user {user_id}."})

# Add other routes like /analyze, /query, etc., here

if __name__ == "__main__":
    app.run(debug=True, port=8080)
