/**
 * Environment Elements for Space Shooter Game
 * Adds interactive elements like asteroids, gravity wells, and wormholes
 * Version 1.0.0
 */

/**
 * Base class for all environment elements
 */
class EnvironmentElement {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Optional parameters
     */
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.isActive = true;
        this.createdAt = Date.now();
        this.rotation = options.rotation || 0;
        this.rotationSpeed = options.rotationSpeed || 0;
        this.dimensions = options.dimensions || { width: 30, height: 30 };
        this.health = options.health || 1;
        this.maxHealth = this.health;
        this.isDestructible = options.isDestructible !== undefined ? options.isDestructible : true;
        
        // Performance flags
        this.performanceMode = 0; // 0=normal, 1=minimal visuals, 2=disabled visuals
    }
    
    /**
     * Update the element's state
     * @param {number} deltaTime - Time passed since last update in milliseconds
     * @param {Player} player - The player object for interaction
     * @param {Array} projectiles - Array of projectiles for collision detection
     * @param {Object} gameData - Additional game data like dimensions, difficulty, etc.
     * @returns {boolean} - Whether this element should be kept (true) or removed (false)
     */
    update(deltaTime, player, projectiles, gameData) {
        // Base update logic - update rotation
        if (this.rotationSpeed) {
            this.rotation += this.rotationSpeed * deltaTime / 1000;
        }
        
        // Check for projectile collisions if destructible
        if (this.isDestructible) {
            for (let i = projectiles.length - 1; i >= 0; i--) {
                if (this.checkCollision(projectiles[i])) {
                    // Take damage from projectile
                    this.takeDamage(projectiles[i].damage || 1);
                    // Mark projectile for removal
                    projectiles[i].isActive = false;
                    
                    // Create impact effect
                    if (!this.performanceMode && gameData.createImpactEffect) {
                        gameData.createImpactEffect(projectiles[i].x, projectiles[i].y);
                    }
                }
            }
        }
        
        // Check for collision with player
        if (player && !player.isInvulnerable && this.checkPlayerCollision(player)) {
            this.onPlayerCollision(player);
        }
        
        // Check if health is depleted
        if (this.isDestructible && this.health <= 0) {
            this.onDestroy();
            return false;
        }
        
        // Check if element has expired
        if (this.lifespan && Date.now() - this.createdAt > this.lifespan) {
            return false;
        }
        
        return this.isActive;
    }
    
    /**
     * Draw the element
     * @param {CanvasRenderingContext2D} ctx - The canvas context
     */
    draw(ctx) {
        // Base implementation - override in subclasses
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Simple rectangle visual for debugging
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(
            -this.dimensions.width / 2,
            -this.dimensions.height / 2,
            this.dimensions.width,
            this.dimensions.height
        );
        
        ctx.restore();
    }
    
    /**
     * Check collision with a circular object
     * @param {Object} obj - Object with x, y properties
     * @param {number} radius - Radius of the circular object
     * @returns {boolean} - Whether collision occurred
     */
    checkCircularCollision(obj, radius) {
        // Distance between centers
        const dx = this.x - obj.x;
        const dy = this.y - obj.y;
        const distanceSq = dx * dx + dy * dy;
        
        // Collision radius (half of element dimensions plus object radius)
        const collisionRadius = Math.max(this.dimensions.width, this.dimensions.height) / 2 + radius;
        
        return distanceSq <= collisionRadius * collisionRadius;
    }
    
    /**
     * Check collision with a projectile
     * @param {Object} projectile - The projectile object
     * @returns {boolean} - Whether collision occurred
     */
    checkCollision(projectile) {
        return this.checkCircularCollision(projectile, projectile.radius || 5);
    }
    
    /**
     * Check collision with the player
     * @param {Player} player - The player object
     * @returns {boolean} - Whether collision occurred
     */
    checkPlayerCollision(player) {
        return this.checkCircularCollision(player, player.size / 2);
    }
    
    /**
     * Handle player collision
     * @param {Player} player - The player that collided with this element
     */
    onPlayerCollision(player) {
        // Base implementation - override in subclasses
        // Default behavior is to damage player
        player.takeDamage(1);
    }
    
    /**
     * Take damage when hit by projectiles
     * @param {number} amount - Amount of damage to take
     */
    takeDamage(amount) {
        if (this.isDestructible) {
            this.health = Math.max(0, this.health - amount);
        }
    }
    
    /**
     * Handle destruction of the element
     */
    onDestroy() {
        // Base implementation - override in subclasses
        this.isActive = false;
    }
    
    /**
     * Set the performance mode level
     * @param {number} mode - Performance mode (0=normal, 1=minimal, 2=disabled)
     */
    setPerformanceMode(mode) {
        this.performanceMode = mode;
    }
}

/**
 * Destructible asteroid that can be shot and damages the player on contact
 */
class Asteroid extends EnvironmentElement {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Optional parameters
     */
    constructor(x, y, options = {}) {
        super(x, y, options);
        
        // Asteroid specific properties
        this.size = options.size || (Math.random() * 20 + 30); // Size between 30-50
        this.dimensions = { width: this.size, height: this.size };
        this.health = options.health || Math.ceil(this.size / 15); // Health based on size
        this.maxHealth = this.health;
        this.color = options.color || '#8c8c8c';
        this.velocity = {
            x: options.velocityX || (Math.random() - 0.5) * 0.5,
            y: options.velocityY || (Math.random() * 0.5 + 0.2)
        };
        this.damage = options.damage || 1;
        this.rotationSpeed = options.rotationSpeed || (Math.random() - 0.5) * 0.02;
        this.fragments = Math.floor(Math.random() * 3) + 3; // 3-5 fragments when destroyed
        this.jaggedness = options.jaggedness || Math.random() * 0.4 + 0.1; // How jagged the asteroid looks
        this.isDestructible = options.isDestructible !== undefined ? options.isDestructible : true;
        
        // Generate vertices for the asteroid shape
        this.generateVertices();
    }
    
    /**
     * Generate random vertices for the asteroid shape
     */
    generateVertices() {
        this.vertices = [];
        const segments = 10;
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // Random radius variation for jagged edges
            const radiusVariation = 1 - this.jaggedness + Math.random() * this.jaggedness * 2;
            const radius = this.size / 2 * radiusVariation;
            
            this.vertices.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
    }
    
    /**
     * Update asteroid position and check for boundaries
     */
    update(deltaTime, player, projectiles, gameData) {
        // Move the asteroid
        this.x += this.velocity.x * deltaTime / 16;
        this.y += this.velocity.y * deltaTime / 16;
        
        // Check if asteroid is out of bounds
        if (
            this.x < -this.size || 
            this.x > gameData.canvasWidth + this.size || 
            this.y < -this.size || 
            this.y > gameData.canvasHeight + this.size
        ) {
            return false;
        }
        
        // Run the standard update from parent class to handle collisions, etc.
        return super.update(deltaTime, player, projectiles, gameData);
    }
    
    /**
     * Draw the asteroid
     */
    draw(ctx) {
        if (this.performanceMode >= 2) return; // Skip rendering in disabled visuals mode
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw the asteroid shape
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        
        ctx.closePath();
        
        // Different rendering based on performance mode
        if (this.performanceMode === 0) {
            // Normal mode with full details
            const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, this.size / 2);
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(1, '#444444');
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Add some crater details
            this.drawCraters(ctx);
        } else {
            // Minimal visuals mode
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Draw health bar for large asteroids if damaged
        if (this.health < this.maxHealth && this.size > 40 && this.performanceMode === 0) {
            this.drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
    
    /**
     * Draw craters on the asteroid for detail
     */
    drawCraters(ctx) {
        // Skip if in performance mode
        if (this.performanceMode > 0) return;
        
        const craterCount = Math.floor(this.size / 15);
        
        for (let i = 0; i < craterCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (this.size / 2 - 5);
            const craterX = Math.cos(angle) * distance;
            const craterY = Math.sin(angle) * distance;
            const craterSize = Math.random() * (this.size / 10) + 2;
            
            ctx.beginPath();
            ctx.arc(craterX, craterY, craterSize, 0, Math.PI * 2);
            ctx.fillStyle = '#555555';
            ctx.fill();
        }
    }
    
    /**
     * Draw a health bar for the asteroid
     */
    drawHealthBar(ctx) {
        const barWidth = this.size * 0.8;
        const barHeight = 4;
        const fillWidth = barWidth * (this.health / this.maxHealth);
        
        // Position the bar above the asteroid
        const barX = -barWidth / 2;
        const barY = -this.size * 0.6 - barHeight;
        
        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw health fill
        ctx.fillStyle = this.health > this.maxHealth / 2 ? '#44ff44' : '#ff4444';
        ctx.fillRect(barX, barY, fillWidth, barHeight);
    }
    
    /**
     * Handle player collision
     */
    onPlayerCollision(player) {
        player.takeDamage(this.damage);
        
        // Smaller asteroids are destroyed on collision
        if (this.size < 40) {
            this.health = 0;
        }
    }
    
    /**
     * Handle asteroid destruction
     */
    onDestroy() {
        super.onDestroy();
        
        // Create asteroid fragments if not in performance mode
        if (this.performanceMode < 2 && this.size > 30 && window.game) {
            this.createFragments();
        }
    }
    
    /**
     * Create smaller asteroid fragments when destroyed
     */
    createFragments() {
        try {
            // Ensure the game object is available
            if (!window.game || !window.game.environmentElements) return;
            
            for (let i = 0; i < this.fragments; i++) {
                // Create smaller asteroids as fragments
                const fragmentSize = this.size / 3;
                if (fragmentSize < 15) continue; // Don't create tiny fragments
                
                const angle = (i / this.fragments) * Math.PI * 2;
                const distance = this.size / 4;
                const fragmentX = this.x + Math.cos(angle) * distance;
                const fragmentY = this.y + Math.sin(angle) * distance;
                
                const fragment = new Asteroid(fragmentX, fragmentY, {
                    size: fragmentSize,
                    velocityX: this.velocity.x + Math.cos(angle) * 0.5,
                    velocityY: this.velocity.y + Math.sin(angle) * 0.5,
                    rotationSpeed: this.rotationSpeed * 2,
                    health: 1,
                    damage: Math.max(1, this.damage - 1)
                });
                
                // Set same performance mode
                fragment.setPerformanceMode(this.performanceMode);
                
                // Add to game's environment elements
                window.game.environmentElements.push(fragment);
            }
        } catch (error) {
            console.error('Error creating asteroid fragments:', error);
        }
    }
}

/**
 * Gravity well that pulls in the player and projectiles
 */
class GravityWell extends EnvironmentElement {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Optional parameters
     */
    constructor(x, y, options = {}) {
        super(x, y, options);
        
        // Gravity well specific properties
        this.radius = options.radius || (Math.random() * 50 + 100); // Radius of influence
        this.strength = options.strength || (Math.random() * 0.05 + 0.02); // Strength of gravity
        this.pulseSpeed = options.pulseSpeed || (Math.random() * 0.5 + 0.5); // Visual pulsing speed
        this.color1 = options.color1 || 'rgba(20, 100, 200, 0.7)';
        this.color2 = options.color2 || 'rgba(20, 50, 100, 0)';
        this.damage = options.damage || 0.5; // Damage per second to player if too close
        this.damageRadius = options.damageRadius || (this.radius * 0.3); // Zone that damages the player
        this.lifespan = options.lifespan || (Math.random() * 10000 + 15000); // 15-25 seconds lifespan
        this.isDestructible = false; // Gravity wells can't be destroyed by shooting
        
        // Inner ring for visualization 
        this.innerRadius = this.radius * 0.3;
        this.innerRotation = 0;
        this.innerRotationSpeed = options.innerRotationSpeed || (Math.random() * 0.002 + 0.001);
        
        // Particles for visual effect
        this.particles = [];
        this.lastParticleTime = 0;
        
        this.dimensions = { width: this.radius * 2, height: this.radius * 2 };
    }
    
    /**
     * Update gravity well effects
     */
    update(deltaTime, player, projectiles, gameData) {
        // Rotate inner ring
        this.innerRotation += this.innerRotationSpeed * deltaTime;
        
        // Update particles
        this.updateParticles(deltaTime);
        
        // Generate new particles occasionally
        this.generateParticles(deltaTime);
        
        // Apply gravity to projectiles
        this.applyGravityToProjectiles(projectiles, deltaTime);
        
        // Apply gravity to player if within range
        if (player) {
            this.applyGravityToPlayer(player, deltaTime);
        }
        
        // Base update handles expiration, etc.
        return super.update(deltaTime, player, projectiles, gameData);
    }
    
    /**
     * Generate particles for visual effect
     */
    generateParticles(deltaTime) {
        // Skip in high performance mode
        if (this.performanceMode > 0) return;
        
        const now = Date.now();
        const timeSinceLastParticle = now - this.lastParticleTime;
        
        // Create new particles based on performance mode
        if (timeSinceLastParticle > (this.performanceMode === 0 ? 200 : 500)) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.radius * (0.7 + Math.random() * 0.3);
            
            this.particles.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                size: Math.random() * 2 + 1,
                alpha: Math.random() * 0.7 + 0.3,
                speed: (this.radius * 0.3) / (Math.random() * 1000 + 1000) // Speed toward center
            });
            
            this.lastParticleTime = now;
        }
    }
    
    /**
     * Update particles moving toward the center
     */
    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Calculate direction to center
            const distance = Math.sqrt(particle.x * particle.x + particle.y * particle.y);
            
            if (distance < 5) {
                // Remove particles that reach the center
                this.particles.splice(i, 1);
                continue;
            }
            
            // Move particle toward center
            const moveAmount = particle.speed * deltaTime;
            particle.x -= (particle.x / distance) * moveAmount;
            particle.y -= (particle.y / distance) * moveAmount;
            
            // Fade out as it approaches center
            if (distance < this.innerRadius) {
                particle.alpha *= 0.95;
            }
            
            // Remove faded particles
            if (particle.alpha < 0.1) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    /**
     * Apply gravity effect to projectiles
     */
    applyGravityToProjectiles(projectiles, deltaTime) {
        const gravityModifier = this.strength * (deltaTime / 16);
        
        for (const projectile of projectiles) {
            // Calculate distance to projectile
            const dx = this.x - projectile.x;
            const dy = this.y - projectile.y;
            const distanceSq = dx * dx + dy * dy;
            const distance = Math.sqrt(distanceSq);
            
            // Only affect projectiles within radius
            if (distance < this.radius) {
                // Calculate force direction
                const directionX = dx / distance;
                const directionY = dy / distance;
                
                // Force decreases with square of distance
                const force = this.radius / (distance * distance) * gravityModifier;
                
                // Apply force to projectile velocity
                projectile.vx += directionX * force;
                projectile.vy += directionY * force;
            }
        }
    }
    
    /**
     * Apply gravity effect to player
     */
    applyGravityToPlayer(player, deltaTime) {
        // Calculate distance to player
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distanceSq = dx * dx + dy * dy;
        const distance = Math.sqrt(distanceSq);
        
        // Only affect player within radius
        if (distance < this.radius) {
            // Calculate force direction
            const directionX = dx / distance;
            const directionY = dy / distance;
            
            // Force decreases with square of distance
            const force = this.radius / (distance * distance) * this.strength * (deltaTime / 16);
            
            // Apply force to player position
            player.x += directionX * force;
            player.y += directionY * force;
            
            // Damage player if too close to center
            if (distance < this.damageRadius) {
                const damageAmount = (this.damage * deltaTime) / 1000;
                player.takeDamage(damageAmount);
            }
        }
    }
    
    /**
     * Draw the gravity well
     */
    draw(ctx) {
        if (this.performanceMode >= 2) return; // Skip rendering in disabled visuals mode
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Calculate pulse effect
        const pulseScale = 1 + Math.sin(Date.now() * this.pulseSpeed / 1000) * 0.1;
        const currentRadius = this.radius * pulseScale;
        const currentInnerRadius = this.innerRadius * pulseScale;
        
        if (this.performanceMode === 0) {
            // Full detail mode
            // Draw outer glow
            const gradient = ctx.createRadialGradient(0, 0, currentInnerRadius, 0, 0, currentRadius);
            gradient.addColorStop(0, this.color1);
            gradient.addColorStop(1, this.color2);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw inner swirl pattern
            this.drawInnerPattern(ctx, currentInnerRadius);
            
            // Draw particles
            this.drawParticles(ctx);
        } else {
            // Minimal visuals mode
            ctx.fillStyle = this.color1;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, currentInnerRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = this.color1;
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * Draw the inner swirling pattern
     */
    drawInnerPattern(ctx, radius) {
        ctx.save();
        ctx.rotate(this.innerRotation);
        
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
        ctx.lineWidth = 1.5;
        
        // Draw spiral swirl
        for (let i = 0; i < 3; i++) {
            const rotation = (i / 3) * Math.PI * 2;
            ctx.save();
            ctx.rotate(rotation);
            
            ctx.beginPath();
            for (let j = 0; j <= 100; j++) {
                const angle = (j / 100) * Math.PI * 4;
                const distance = (j / 100) * radius;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                if (j === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.restore();
        }
        
        // Draw central core
        ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    /**
     * Draw the particles moving toward the center
     */
    drawParticles(ctx) {
        for (const particle of this.particles) {
            ctx.fillStyle = `rgba(100, 200, 255, ${particle.alpha})`;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    /**
     * Check for player collision - doesn't harm player directly, gravity does
     */
    checkPlayerCollision(player) {
        // Always return false as the gravity effect is handled separately
        return false;
    }
}

/**
 * Wormhole that teleports the player to another location
 */
class Wormhole extends EnvironmentElement {
    /**
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Optional parameters
     */
    constructor(x, y, options = {}) {
        super(x, y, options);
        
        // Wormhole specific properties
        this.radius = options.radius || (Math.random() * 20 + 40); // Visible radius
        this.effectRadius = this.radius * 1.2; // Actual effect radius
        this.rotationSpeed = options.rotationSpeed || (Math.random() * 0.005 + 0.002);
        this.innerRotation = 0;
        this.innerRotationSpeed = options.innerRotationSpeed || this.rotationSpeed * -2;
        this.color1 = options.color1 || 'rgba(180, 50, 200, 0.7)';
        this.color2 = options.color2 || 'rgba(50, 20, 100, 0)';
        this.lifespan = options.lifespan || (Math.random() * 5000 + 10000); // 10-15 seconds lifespan
        this.isDestructible = false; // Wormholes can't be destroyed by shooting
        
        // Teleportation properties
        this.teleportCooldown = 3000; // 3 seconds cooldown between teleports
        this.lastTeleportTime = 0; // Last time a teleport happened
        this.isTeleporting = false; // Currently in teleport animation
        
        // Destination - if not specified, will be random when teleporting
        this.destination = options.destination || null;
        
        // Visual effects for the wormhole
        this.particles = [];
        this.lastParticleTime = 0;
        
        this.dimensions = { width: this.effectRadius * 2, height: this.effectRadius * 2 };
    }
    
    /**
     * Update wormhole rotation and effects
     */
    update(deltaTime, player, projectiles, gameData) {
        // Rotate wormhole
        this.rotation += this.rotationSpeed * deltaTime;
        this.innerRotation += this.innerRotationSpeed * deltaTime;
        
        // Update particles
        this.updateParticles(deltaTime);
        
        // Generate new particles occasionally
        if (this.performanceMode === 0) {
            this.generateParticles(deltaTime);
        }
        
        // Check for player wormhole entry
        if (player && !this.isTeleporting) {
            const dx = this.x - player.x;
            const dy = this.y - player.y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq <= this.radius * this.radius) {
                this.teleportPlayer(player, gameData);
            }
        }
        
        // Run standard update
        return super.update(deltaTime, player, projectiles, gameData);
    }
    
    /**
     * Generate particles for visual effect
     */
    generateParticles(deltaTime) {
        const now = Date.now();
        const timeSinceLastParticle = now - this.lastParticleTime;
        
        if (timeSinceLastParticle > 100) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.radius * (0.8 + Math.random() * 0.5);
            
            this.particles.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                size: Math.random() * 2 + 1,
                alpha: Math.random() * 0.7 + 0.3,
                speed: (this.radius * 0.4) / (Math.random() * 500 + 500), // Speed toward center
                color: Math.random() < 0.5 ? 
                    'rgba(180, 100, 255, 0.7)' : 'rgba(100, 50, 180, 0.7)'
            });
            
            this.lastParticleTime = now;
        }
    }
    
    /**
     * Update particles moving toward the center
     */
    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Calculate direction to center
            const distance = Math.sqrt(particle.x * particle.x + particle.y * particle.y);
            
            if (distance < 5) {
                // Remove particles that reach the center
                this.particles.splice(i, 1);
                continue;
            }
            
            // Move particle toward center
            const moveAmount = particle.speed * deltaTime;
            particle.x -= (particle.x / distance) * moveAmount;
            particle.y -= (particle.y / distance) * moveAmount;
            
            // Fade out as it approaches center
            if (distance < this.radius * 0.3) {
                particle.alpha *= 0.95;
            }
            
            // Remove faded particles
            if (particle.alpha < 0.1) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    /**
     * Teleport the player to a different location
     */
    teleportPlayer(player, gameData) {
        const now = Date.now();
        
        // Check cooldown
        if (now - this.lastTeleportTime < this.teleportCooldown) {
            return;
        }
        
        this.lastTeleportTime = now;
        this.isTeleporting = true;
        
        try {
            // Create teleport effect at current location if available
            if (gameData.createTeleportEffect) {
                gameData.createTeleportEffect(player.x, player.y);
            }
            
            // Calculate destination
            let destX, destY;
            
            if (this.destination) {
                // Use predetermined destination
                destX = this.destination.x;
                destY = this.destination.y;
            } else {
                // Random location on the screen
                const padding = 100;
                destX = padding + Math.random() * (gameData.canvasWidth - padding * 2);
                destY = padding + Math.random() * (gameData.canvasHeight - padding * 2);
            }
            
            // Apply destination with a short delay for visual effect
            setTimeout(() => {
                player.x = destX;
                player.y = destY;
                
                // Create teleport effect at destination
                if (gameData.createTeleportEffect) {
                    gameData.createTeleportEffect(destX, destY);
                }
                
                // Reset teleporting flag after effect delay
                setTimeout(() => {
                    this.isTeleporting = false;
                }, 500);
            }, 300);
        } catch (error) {
            console.error('Error during player teleport:', error);
            this.isTeleporting = false;
        }
    }
    
    /**
     * Draw the wormhole
     */
    draw(ctx) {
        if (this.performanceMode >= 2) return; // Skip rendering in disabled visuals mode
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw based on performance mode
        if (this.performanceMode === 0) {
            // Full detail mode
            // Draw outer glow
            const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius);
            gradient.addColorStop(0, 'rgba(180, 100, 255, 0.8)');
            gradient.addColorStop(0.5, 'rgba(100, 50, 180, 0.5)');
            gradient.addColorStop(1, 'rgba(50, 20, 100, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw wormhole swirl effect
            ctx.rotate(this.rotation);
            this.drawWormholePattern(ctx);
            
            // Draw particles
            this.drawParticles(ctx);
            
            // Draw center
            const centerGradient = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius * 0.2);
            centerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            centerGradient.addColorStop(0.5, 'rgba(200, 150, 255, 0.7)');
            centerGradient.addColorStop(1, 'rgba(100, 50, 180, 0)');
            
            ctx.fillStyle = centerGradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Minimal visuals mode
            ctx.fillStyle = 'rgba(150, 100, 200, 0.5)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(180, 100, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * Draw the wormhole spiral pattern
     */
    drawWormholePattern(ctx) {
        ctx.save();
        
        // Draw spiral arms
        for (let arm = 0; arm < 3; arm++) {
            ctx.save();
            ctx.rotate((arm / 3) * Math.PI * 2);
            
            ctx.strokeStyle = 'rgba(200, 100, 255, 0.6)';
            ctx.lineWidth = 3;
            
            // Draw spiral
            ctx.beginPath();
            for (let i = 0; i <= 100; i++) {
                const angle = (i / 25) * Math.PI;
                const distance = (i / 100) * this.radius * 0.9;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Draw inner wormhole ring
        ctx.save();
        ctx.rotate(this.innerRotation);
        
        ctx.strokeStyle = 'rgba(255, 200, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
        ctx.restore();
    }
    
    /**
     * Draw the particles around the wormhole
     */
    drawParticles(ctx) {
        for (const particle of this.particles) {
            ctx.fillStyle = particle.color || `rgba(180, 100, 255, ${particle.alpha})`;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    /**
     * Check player collision - no direct collision handling as teleport is handled separately
     */
    checkPlayerCollision(player) {
        return false;
    }
}

// Export the environment elements
window.EnvironmentElement = EnvironmentElement;
window.Asteroid = Asteroid;
window.GravityWell = GravityWell;
window.Wormhole = Wormhole;