/**
 * Score Manager
 * Manages player score saving and high score retrieval
 * Version 1.1.0 - Added guest player support
 */
class ScoreManager {
    constructor() {
        this.scores = [];
        this.currentScore = 0;
        this.playerName = "Guest";
    }

    /**
     * Initialize the score manager
     */
    initialize() {
        console.log("Score manager initialized");
        
        // Listen for game start to capture player name
        document.addEventListener('DOMContentLoaded', () => {
            // Add event listener to the start button
            const startButton = document.querySelector('.btn-start-game');
            if (startButton) {
                startButton.addEventListener('click', this.capturePlayerName.bind(this));
            }
        });
    }
    
    /**
     * Capture the player name when starting the game
     */
    capturePlayerName() {
        const playerNameInput = document.getElementById('playerNameInput');
        if (playerNameInput && playerNameInput.value.trim() !== '') {
            this.playerName = playerNameInput.value.trim();
        } else {
            this.playerName = "Guest";
        }
        console.log(`Player name set to: ${this.playerName}`);
    }

    /**
     * Save a score to the backend
     * @param {number} score - The score to save
     * @param {string} playerName - Optional player name
     * @returns {Promise} - Promise resolving to the save result
     */
    async saveScore(score, playerName = "Anonymous") {
        try {
            const response = await fetch('/save_score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    score: score,
                    player_name: playerName
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log(`Score ${score} saved successfully with ID: ${result.score_id}`);
                return true;
            } else {
                console.error(`Error saving score: ${result.error}`);
                return false;
            }
        } catch (error) {
            console.error('Error saving score:', error);
            return false;
        }
    }

    /**
     * Handle game over by saving the score
     * @param {number} score - The final score
     */
    async handleGameOver(score) {
        this.currentScore = score;
        
        // Update the UI
        const finalScoreElement = document.getElementById('finalScore');
        if (finalScoreElement) {
            finalScoreElement.textContent = score;
        }
        
        // Display player name in game over screen
        const playerNameDisplay = document.getElementById('playerNameDisplay');
        if (playerNameDisplay) {
            playerNameDisplay.textContent = `Played as: ${this.playerName}`;
        }
        
        // Save the score to the backend with player name
        const savedSuccessfully = await this.saveScore(score, this.playerName);
        
        // Show save status if needed
        if (savedSuccessfully) {
            console.log(`Score ${score} saved successfully for player: ${this.playerName}`);
        }
    }
}