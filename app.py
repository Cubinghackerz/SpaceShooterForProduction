from flask import Flask, render_template, request, jsonify
import psycopg2
import os

app = Flask(__name__)

# Database connection setup
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    return conn

# Route to serve the main page
@app.route('/')
def index():
    return render_template('index.html')  # Make sure your index.html is in templates/

# API to save score
@app.route('/save-score', methods=['POST'])
def save_score():
    data = request.json
    name = data.get('name')
    score = data.get('score')

    if not name or score is None:
        return jsonify({'error': 'Missing name or
