import time
from flask import Flask, render_template, request, redirect, url_for, flash
import os
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from urllib.parse import urlparse
import logging
import json

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Initialize Flask app
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Database configuration
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "default_secret_key")

# Initialize database
db = SQLAlchemy(app)

# Initialize login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Import models after db initialization
from models import User, Score
from forms import LoginForm, RegistrationForm

# Create tables
try:
    with app.app_context():
        db.create_all()
except Exception as e:
    app.logger.error(f"Database initialization error: {e}")
    print("Failed to initialize database. Please check your DATABASE_URL environment variable.")

# Store active game rooms and players
game_rooms = {}
player_rooms = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/save_score', methods=['POST'])
def save_score():
    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return {'success': False, 'error': 'No data provided'}, 400
        
        score_value = data.get('score')
        player_name = data.get('player_name', 'Anonymous')
        
        if not score_value:
            return {'success': False, 'error': 'No score provided'}, 400
        
        score = Score(score=score_value, player_name=player_name)
        
        # If user is logged in, associate score with user
        if current_user.is_authenticated:
            score.user_id = current_user.id
            score.player_name = current_user.username
        
        try:
            db.session.add(score)
            db.session.commit()
            return {'success': True, 'score_id': score.id}, 200
        except Exception as e:
            app.logger.error(f"Error saving score: {e}")
            db.session.rollback()
            return {'success': False, 'error': str(e)}, 500

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user is None or not user.check_password(form.password.data):
            flash('Invalid email or password')
            return redirect(url_for('login'))
        
        login_user(user, remember=form.remember_me.data)
        next_page = request.args.get('next')
        if not next_page or urlparse(next_page).netloc != '':
            next_page = url_for('index')
        
        flash(f'Welcome back, {user.username}!')
        return redirect(next_page)
    
    return render_template('login.html', title='Sign In', form=form)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        
        flash('Congratulations, you are now registered! Please log in.')
        return redirect(url_for('login'))
    
    return render_template('register.html', title='Register', form=form)

@app.route('/logout')
def logout():
    logout_user()
    flash('You have been logged out.')
    return redirect(url_for('index'))

@app.route('/profile')
@login_required
def profile():
    # Get user's high scores
    scores = Score.query.filter_by(user_id=current_user.id).order_by(Score.score.desc()).limit(10).all()
    return render_template('profile.html', title='Profile', user=current_user, scores=scores)

@app.route('/leaderboard')
def leaderboard():
    # Get top 20 scores of all time
    top_scores = Score.query.order_by(Score.score.desc()).limit(20).all()
    
    # Get current user's rank if logged in
    user_rank = None
    user_best_score = None
    
    if current_user.is_authenticated:
        user_best = Score.query.filter_by(user_id=current_user.id).order_by(Score.score.desc()).first()
        
        if user_best:
            user_best_score = user_best
            # Count how many scores are higher than the user's best score
            user_rank = Score.query.filter(Score.score > user_best.score).count() + 1
    
    return render_template('leaderboard.html', title='Leaderboard', 
                          top_scores=top_scores, 
                          user_rank=user_rank, 
                          user_best_score=user_best_score)

@socketio.on('connect')
def handle_connect():
    logging.info(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    player_id = request.sid
    if player_id in player_rooms:
        room = player_rooms[player_id]
        leave_room(room)
        if room in game_rooms:
            game_rooms[room]['players'].remove(player_id)
            emit('player_left', {'player_id': player_id}, room=room)
            if len(game_rooms[room]['players']) == 0:
                del game_rooms[room]
        del player_rooms[player_id]

@socketio.on('join_game')
def handle_join_game(data):
    player_id = request.sid
    room = data.get('room', 'default')

    # Create room if it doesn't exist
    if room not in game_rooms:
        game_rooms[room] = {'players': [], 'state': {}}

    # Add player to room
    join_room(room)
    game_rooms[room]['players'].append(player_id)
    player_rooms[player_id] = room

    # Notify other players
    emit('player_joined', {
        'player_id': player_id,
        'players': game_rooms[room]['players']
    }, room=room)

@socketio.on('player_state')
def handle_player_state(data):
    player_id = request.sid
    if player_id in player_rooms:
        room = player_rooms[player_id]
        game_rooms[room]['state'][player_id] = data
        emit('game_state_update', {
            'player_id': player_id,
            'state': data
        }, room=room, include_self=False)

@socketio.on('chat_message')
def handle_chat_message(data):
    player_id = request.sid
    if player_id in player_rooms:
        room = player_rooms[player_id]
        message = {
            'id': str(hash(f"{player_id}-{data.get('text', '')}-{time.time()}")),
            'player_id': player_id,
            'text': data.get('text', ''),
            'timestamp': time.time(),
            'reactions': {}
        }
        # Store message in room state
        if 'messages' not in game_rooms[room]:
            game_rooms[room]['messages'] = []
        game_rooms[room]['messages'].append(message)
        # Broadcast to room
        emit('new_chat_message', message, room=room)

@socketio.on('add_reaction')
def handle_reaction(data):
    player_id = request.sid
    if player_id in player_rooms:
        room = player_rooms[player_id]
        message_id = data.get('message_id')
        emoji = data.get('emoji')

        # Find message and update reactions
        for message in game_rooms[room].get('messages', []):
            if message['id'] == message_id:
                if emoji not in message['reactions']:
                    message['reactions'][emoji] = []
                if player_id not in message['reactions'][emoji]:
                    message['reactions'][emoji].append(player_id)
                    emit('reaction_update', {
                        'message_id': message_id,
                        'reactions': message['reactions']
                    }, room=room)
                break

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)