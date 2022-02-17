window.requestAnimFrame = function () {
	return (
		window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function (/* function */ callback) {
			window.setTimeout(callback, 1000 / 60);
		}
	);
}();
(function () {
	var pressedKeys = {};
	function setKey(event, status) {
		var code = event.keyCode;
		var key;

		switch (code) {
			// case 32:
			// 	key = 'SPACE'; break;
			case 37:
				key = 'LEFT'; break;
			case 38:
				key = 'UP'; break;
			case 39:
				key = 'RIGHT'; break;
			case 40:
				key = 'DOWN'; break;
			default:
				// Convert ASCII codes to letters
				key = String.fromCharCode(code);
		}
		pressedKeys[key] = status;
	}
	document.addEventListener('keydown', function (e) {
		if (e.keyCode === 32) {
			pressedKeys['SPACE'] = !pressedKeys['SPACE'];
		}
		setKey(e, true);
	});
	document.addEventListener('keyup', function (e) {
		setKey(e, false);
	});
	// document.querySelector('.controller__pause').addEventListener('touchstart', function () {
	// 	pressedKeys['SPACE'] = !pressedKeys['SPACE'];
	// });
	document.querySelector('.controller__left').addEventListener('touchstart', function (e) {
		e.keyCode = 37;
		setKey(e, true);
	});
	document.querySelector('.controller__left').addEventListener('touchend', function (e) {
		e.keyCode = 37;
		setKey(e, false);
	});
	document.querySelector('.controller__up').addEventListener('touchstart', function (e) {
		e.keyCode = 38;
		setKey(e, true);
	});
	document.querySelector('.controller__up').addEventListener('touchend', function (e) {
		e.keyCode = 38;
		setKey(e, false);
	});
	document.querySelector('.controller__right').addEventListener('touchstart', function (e) {
		e.keyCode = 39;
		setKey(e, true);
	});
	document.querySelector('.controller__right').addEventListener('touchend', function (e) {
		e.keyCode = 39;
		setKey(e, false);
	});
	document.querySelector('.controller__down').addEventListener('touchstart', function (e) {
		e.keyCode = 40;
		setKey(e, true);
	});
	document.querySelector('.controller__down').addEventListener('touchend', function (e) {
		e.keyCode = 40;
		setKey(e, false);
	});
	window.addEventListener('blur', function () {
		pressedKeys = {};
	});
	window.input = {
		isDown: function (key) {
			return pressedKeys[key.toUpperCase()];
		}
	};
})();

let isTouchScreen = false;
const imagesCache = {};
const audioBuffer = {};

class World {
	constructor(asteroidsTypeMap, speedMultiplier, darkness, slime, background, world, ctx) {
		this.asteroidsTypeMap = asteroidsTypeMap;
		this.speedMultiplier = speedMultiplier;
		this.darkness = darkness;
		this.slime = slime;
		this.world = world;
		this.ctx = ctx;
		this.background = BackgroundFactory.createBackground(background);
		this.spaceship = SpaceshipFactory.createSpaceship();
		this.asteroids = [];
		this.powerUps = [];
		this.slimes = [];
		this.powerUpInterval = 15;
		this.speedRatio = 1;
		this.baseAsteroidsOnScreen = 3;
		this.asteroidsOnScreen = this.baseAsteroidsOnScreen;
		this.asteroidsInterval = 0;
		this.score = 0;
		this.powerUpCounter = 0;
		this.spawnAsteroids = false;
		this.isGameOver = false;
		this.lastTime = Date.now();
		this.slowTimeOut;
		this.playerData = JSON.parse(localStorage.getItem('player'));
		this.isPause = false;
		this.removeAllStates();
		this.loop();
	}
	removeAllStates() {
		const states = document.querySelectorAll('.state');
		if (states.length === 0) return;
		states.forEach(element => element.remove());
	}
	loop() {
		const now = Date.now();
		const dt = (now - this.lastTime) / 1000.0;
		this.update(dt);
		this.render();
		this.lastTime = now;
		requestAnimFrame(() => this.loop());
	}
	render() {
		let ctx = this.ctx
		ctx.clearRect(0, 0, 1200, 800);
		ctx.mozImageSmoothingEnabled = false;
		ctx.webkitImageSmoothingEnabled = false;
		ctx.msImageSmoothingEnabled = false;
		ctx.imageSmoothingEnabled = false;
		this.background.render(ctx);
		this.asteroids.forEach(element => element.render(ctx));
		this.powerUps.forEach(element => element.render(ctx));
		this.slimes.forEach(element => element.render(ctx));
		this.spaceship.render(ctx);
		this.renderScore()
		this.renderPlayerLives();
	}
	renderScore() {
		document.getElementById('score').innerHTML = this.score;
	}
	renderPlayerLives() {
		const lives = document.querySelectorAll('.life__img');
		if (lives.length > 0) {
			lives.forEach(element => element.remove());
		}
		if (this.spaceship.extraLife === 0) return;
		for (let i = 0; i < this.spaceship.extraLife; i++) {
			const lifeImg = imagesCache.life.cloneNode(false);
			lifeImg.classList.add('life__img');
			document.querySelector('.life').appendChild(lifeImg);
		}
	}
	update(dt) {
		// if (input.isDown('SPACE') === !this.isPause && this.isGameOver !== true) {
		// 	this.tooglePause();
		// }
		if (this.isPause === true) return
		this.moveObjects(dt);
		this.updateSprites(dt);
		this.generateAsteroid(dt);
		this.removeObjects(this.asteroids);
		this.removeObjects(this.powerUps);
		if (this.isGameOver === true) return;
		this.addDarkness();
		this.spaceship.moveSpaceship(dt);
		this.checkCollisions();
	}
	updateSprites(dt) {
		this.spaceship.updateSprite(dt);
		this.asteroids.forEach(element => element.updateSprite(dt));
		this.powerUps.forEach(element => element.updateSprite(dt));
		this.slimes.forEach(element => element.updateSprite(dt));
	}
	moveObjects(dt) {
		this.asteroids.forEach(element => element.move(dt));
		this.powerUps.forEach(element => element.move(dt));
		this.slimes.forEach(element => element.move(dt));
		this.background.move(dt);
	}
	updateScore() {
		this.score++;
		this.powerUpCounter++;
		if (this.slime) {
			if (Math.floor(Math.random() * 10) === 0) {
				this.generateSlime()
			}
		}
		if (this.powerUpCounter === this.powerUpInterval) {
			this.generatePowerUp();
			this.powerUpCounter = 0;
		}
		this.asteroidsOnScreen = Math.floor(this.score / 50) + this.baseAsteroidsOnScreen;
		if (this.score >= 300 && this.playerData.worlds[this.world] < 300) {
			this.isGameOver = true;
			this.playerData.worlds[this.world] = this.score;
			this.savePLayerData();
			setTimeout(() => this.worldCompleted(), 500);
		}
	}
	tooglePause() {
		if (this.isPause) {
			this.pauseState.remove();
			delete this.pauseState;
		} else {
			const newPause = GameStateFactory.createGameState('pause');
			this.pauseState = newPause;
			this.pauseState.add();
		}
		this.isPause = !this.isPause;
	}
	savePLayerData() {
		localStorage.setItem('player', JSON.stringify(this.playerData));
	}
	worldCompleted() {
		const worldCompleted = GameStateFactory.createGameState('worldCompleted');
		worldCompleted.add();
		audioBuffer.theme.stop();
		audioBuffer.levelCompleted.play();
	}
	generateAsteroid(dt) {
		if (!this.spawnTimeOut && this.spawnAsteroids === false) {
			this.spawnTimeOut = setTimeout(() => this.spawnAsteroids = true, 2000);
			return;
		}
		if (this.spawnAsteroids === false) return;
		if (this.asteroids.length > this.asteroidsOnScreen - 1) return;
		this.asteroidsInterval += dt;
		if (this.asteroidsInterval < 0.1) return;
		this.asteroidsInterval = 0;
		let newAsteroid = AsteroidFactory.createAsteroid(this.asteroidsTypeMap[Math.floor(Math.random() * this.asteroidsTypeMap.length)]);
		newAsteroid.speed *= this.speedRatio * this.speedMultiplier;
		this.asteroids.push(newAsteroid);
	}
	generatePowerUp() {
		let type = Math.floor(Math.random() * 4);
		let newPowerUp = PowerUpFactory.createPowerUp(type);
		this.powerUps.push(newPowerUp);
	}
	generateSlime() {
		let newSlime = SlimeFactory.createSlime();
		this.slimes.push(newSlime);
	}
	checkCollisions() {
		if (this.spaceship.checkCollision(this.asteroids)) {
			this.gameOver();
		}
		const newPowerUp = this.spaceship.checkCollision(this.powerUps);
		if (newPowerUp && this.spaceship.isSlimed === false) {
			switch (this.powerUps[0].effect) {
				case 0:
					audioBuffer.slow.play();
					this.slowAsteroids();
					break;
				case 1:
					audioBuffer.flash.play();
					this.flash();
					break;
				case 2:
					audioBuffer.invisibility.play();
					this.spaceship.invisibility(5000);
					break;
				case 3:
					audioBuffer.extraLife.play();
					this.spaceship.addExtraLife();
					break;
			}
			this.powerUps = [];
		}
		const slimeCollision = this.spaceship.checkCollision(this.slimes)
		if (slimeCollision && this.spaceship.speed !== 100 && this.spaceship.isInvisible === false) {
			audioBuffer.impact.play();
			slimeCollision.crash();
			this.spaceship.speed = 100;
			setTimeout(() => {
				this.spaceship.addSlime();
				this.slimes = [];
			}, 100);
		}
	}
	removeObjects(objectsArr) {
		for (let i = 0; i < objectsArr.length; i++) {
			if (objectsArr[i].x < 0 - objectsArr[i].width) {
				objectsArr.splice(i, 1);
				if (this.isGameOver === false) {
					this.updateScore();
				}
			}
		}
	}
	gameOver() {
		if (this.spaceship.isInvisible === true) return
		audioBuffer.impact.play();
		if (this.spaceship.isSlimed) this.spaceship.removeSlime();
		if (this.spaceship.extraLife > 0) {
			return this.spaceship.removeExtraLife();
		}
		this.isGameOver = true;
		this.spaceship.crash();
		if (this.score > this.playerData.worlds[this.world]) {
			this.playerData.worlds[this.world] = this.score;
			this.savePLayerData();
		}
		setTimeout(() => {
			const gameOver = GameStateFactory.createGameState('gameOver', this.score, this.world);
			gameOver.add();
			audioBuffer.theme.stop();
			audioBuffer.gameOver.play();
		}, 1000);
	}
	slowAsteroids() {
		if (this.speedRatio === 1) {
			this.asteroids.forEach(element => element.speed *= 0.5);
		}
		this.speedRatio = 0.5;
		clearTimeout(this.slowTimeOut);
		this.slowTimeOut = setTimeout(() => this.speedRatio = 1, 10000);
	}
	speedUpAsteroids() {
		if (this.speedRatio === 1) {
			this.asteroids.forEach(element => element.speed *= 1.5);
		}
		this.speedRatio = 1.5;
		setTimeout(() => this.speedRatio = 1, 10000);
	}
	flash() {
		const flash = GameStateFactory.createGameState('flash');
		flash.add();
		this.score += this.asteroids.length;
		this.updateScore();
		this.asteroids = [];
		this.spawnAsteroids = false;
		setTimeout(() => {
			this.spawnAsteroids = true;
			flash.remove();
		}, 2000);
	}
	addDarkness() {
		if (document.querySelector('.darkness') || this.darkness === false) return
		const darkness = GameStateFactory.createGameState('darkness');
		darkness.add();
		setTimeout(() => darkness.remove(), 5000);
	}
}

class WorldFactory {
	static createWorld(type, ctx) {
		let typeOptionsMap = {
			"0": [[0, 1], 1, false, false, 1, 0],
			"1": [[0, 1, 2], 1, false, false, 2, 1],
			"2": [[0, 1, 2, 3], 1, false, false, 3, 2],
			"3": [[0, 1, 2, 3, 4], 1, false, false, 4, 3],
			"4": [[0, 1, 2, 3, 4, 5], 1, false, false, 5, 4],
			"5": [[0, 1, 2, 3, 4, 5, 6], 1, false, false, 6, 5],
			"6": [[7], 1.5, false, false, 7, 6],
			"7": [[0, 1, 2, 3, 4, 5, 6], 1, true, false, 8, 7],
			"8": [[8], 0.5, false, false, 9, 8],
			"9": [[3, 4, 5, 6], 1, true, false, 10, 9],
			"10": [[9], 1, false, false, 11, 10],
			"11": [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 1, false, false, 12, 11],
			"12": [[3, 5], 1, false, true, 13, 12],
			"13": [[1, 4, 10], 1, false, true, 14, 13],
			"14": [[0, 1, 2, 3, 4, 5, 6, 7, 8], 1.2, false, true, 15, 14],
			"15": [[2, 9, 10], 1, false, true, 16, 15],
		};
		return new World(...typeOptionsMap[type], ctx);
	}
}

class GameState {
	constructor(classes, markUp) {
		this.classes = classes;
		this.markUp = markUp;
		this.state = document.createElement('div');
	}
	add() {
		this.state.classList.add('state', this.classes);
		if (this.markUp) this.state.innerHTML = this.markUp;
		document.querySelector('.canvas').append(this.state);
	}
	remove() {
		this.state.remove();
	}
}

class GameStateFactory {
	static createGameState(type, score, world) {
		let typeOptionsMap = {
			"gameOver": ['state_background', `
				<div class="title title_size_m">Game Over</div>
				<div class="caption">You scored: ${score}</div>
				<button data-world="${world}" class="screen__btn gameRestart">Restart</button>
				<button data-screen="worlds" class="screen__btn">Change World</button>
			`],
			"worldCompleted": ['state_background', `
				<div class="title title_size_m">World completed!</div>
				<button data-screen="worlds" class="screen__btn">Next world</button>
			`],
			"pause": ['state_background', `
				<div class="title title_size_m">Pause</div>
			`],
			"flash": ['flash'],
			"darkness": ['darkness'],
		};
		return new GameState(...typeOptionsMap[type]);
	}
}

class Background {
	constructor(img) {
		this.img = img;
		this.width = img.naturalWidth;
		this.scroll = 0;
	}
	move(dt) {
		this.scroll += 150 * dt;
		if (this.scroll > this.width) {
			this.scroll = 0;
		}
	}
	render(ctx) {
		ctx.drawImage(this.img, this.scroll, 0, this.width - this.scroll, 800, 0, 0, this.width - this.scroll, 800);
		ctx.drawImage(this.img, 0, 0, this.scroll, 800, this.width - this.scroll, 0, this.scroll, 800);
	}
}

class BackgroundFactory {
	static createBackground(type, ctx) {
		let typeOptionsMap = {
			"1": imagesCache.world1,
			"2": imagesCache.world2,
			"3": imagesCache.world3,
			"4": imagesCache.world4,
			"5": imagesCache.world5,
			"6": imagesCache.world6,
			"7": imagesCache.world7,
			"8": imagesCache.world8,
			"9": imagesCache.world9,
			"10": imagesCache.world10,
			"11": imagesCache.world11,
			"12": imagesCache.world12,
			"13": imagesCache.world13,
			"14": imagesCache.world14,
			"15": imagesCache.world15,
			"16": imagesCache.world16,
		};
		return new Background(typeOptionsMap[type], ctx);
	}
}

class InGameObject {
	constructor(frames, frameSpeed) {
		this.frame = 1;
		this.frames = frames;
		this.frameSpeed = frameSpeed;
		this.frameTime = 0;
	}
	move(dt) {
		this.x -= this.speed * dt;
		switch (this.movingType) {
			case 0: break;
			case 1: this.y -= this.speed / (1200 / this.dY) * dt; break;
			case 2: {
				if (this.y > 800 - this.height) {
					this.y = 800 - this.height;
				}
				this.y += Math.abs(this.x * dt / 10);
			} break;
			case 3: {
				if (this.y > 800 - this.height) {
					this.y = 800 - this.height;
				}
				if (this.y < 0) {
					this.y = 0;
				}
				this.y += 5 * Math.sin(this.x / 2.5 * dt);
			} break;
			case 4: {
				if (!this.defaultY) {
					let random = Math.random();
					if (random < 0.5) {
						this.k = -1;
						this.y = 800;
					} else {
						this.k = 1;
						this.y = 0;
					}
					this.defaultY = true;
				}
				this.y += (500 * Math.tan(this.x / 1200 * dt)) * this.k;
			} break;
			case 5: {
				this.x += this.speed * dt * 2;
			} break;
			case 6: {
				if (this.y > 800 - this.height) {
					this.y = 800 - this.height;
				}
				if (this.y < 0) {
					this.y = 0;
				}
				this.y += 5 * Math.cos(this.x / 2.5 * dt);
			} break;
		}
	}
	render(ctx) {
		ctx.drawImage(this.img, (this.frame * this.width) - this.width, 0, this.width, this.height, this.x, this.y, this.width, this.height);
	}
	updateSprite(dt) {
		this.frameTime += dt;
		if (this.frameTime > this.frameSpeed / 1000) {
			this.frame++
			this.frameTime = 0;
		}
		if (this.frame > this.frames) this.frame = 1;
	}
}

class Spaceship extends InGameObject {
	constructor(frames, frameSpeed) {
		super(frames, frameSpeed);
		this.width = 50;
		this.height = 50;
		this.x = 20;
		this.y = 385;
		this.speed = 500;
		this.img = imagesCache.ship;
		this.hitRadius = 17;
		this.extraLife = 0;
		this.maxExtraLife = 1;
		this.isInvisible = false;
		this.isSlimed = false;
	}
	moveSpaceship(dt) {
		if (input.isDown('LEFT') || input.isDown('a')) {
			this.x -= this.speed * dt;
			if (this.x < 0) this.x = 0;
		}
		if (input.isDown('RIGHT') || input.isDown('d')) {
			this.x += this.speed * dt;
			if (this.x > 1200 - this.width) this.x = 1200 - this.width;
		}
		if (input.isDown('DOWN') || input.isDown('s')) {
			this.y += this.speed * dt;
			if (this.y > 800 - this.height) this.y = 800 - this.height;
		}
		if (input.isDown('UP') || input.isDown('w')) {
			this.y -= this.speed * dt;
			if (this.y < 0) this.y = 0;
		}
		if (input.isDown('SPACE')) {
		}
	}
	checkCollision(objectsArr) {
		for (let i = 0; i < objectsArr.length; i++) {
			if (Math.hypot(Math.abs((this.x + this.width / 2) - (objectsArr[i].x + objectsArr[i].width / 2)), Math.abs((this.y + this.height / 2) - (objectsArr[i].y + objectsArr[i].height / 2))) <= this.hitRadius + objectsArr[i].hitRadius) {
				return objectsArr[i];
			}
		}
	}
	addExtraLife() {
		if (this.extraLife === this.maxExtraLife) return
		this.extraLife++;
	}
	removeExtraLife() {
		this.extraLife--;
		this.invisibility(2000);
	}
	invisibility(time) {
		this.isInvisible = true;
		this.img = imagesCache.invisibility;
		if (this.invisibilityTimeOut) clearTimeout(this.invisibilityTimeOut);
		this.invisibilityTimeOut = setTimeout(() => this.removeInvisibility(), time);
	}
	removeInvisibility() {
		this.isInvisible = false;
		this.img = imagesCache.ship;
	}
	addSlime() {
		this.isSlimed = true;
		this.speed = 350;
		this.img = imagesCache.slimed;
		if (this.slimeTimeOut) clearTimeout(this.slimeTimeOut);
		this.slimeTimeOut = setTimeout(() => this.removeSlime(), 7000);
	}
	removeSlime() {
		if (this.slimeTimeOut) clearTimeout(this.slimeTimeOut);
		this.isSlimed = false;
		this.speed = 500;
		this.img = imagesCache.ship;
	}
	crash() {
		this.img = imagesCache.alien;
		this.frames = 4;
	}
}

class SpaceshipFactory {
	static createSpaceship() {
		return new Spaceship(6, 40);
	}
}

class Asteroid extends InGameObject {
	constructor(width, height, frames, frameSpeed, movingType, img) {
		super(frames, frameSpeed);
		this.width = width;
		this.height = height;
		this.x = 1200;
		this.y = Math.floor(Math.random() * (800 - height));
		this.speed = Math.floor(500 + Math.random() * (900 + 1 - 500));
		this.movingType = movingType;
		this.img = img;
		this.hitRadius = (width / 2) - 1;
		this.destY = Math.floor(Math.random() * (800 - this.height));
		this.dY = this.y - this.destY;
	}
}

class AsteroidFactory {
	static createAsteroid(type) {
		let rand = Math.floor(Math.random() * 5);
		let typeOptionsMap = {
			"0": [100, 100, 8, 60, 0, imagesCache.asteroid0],
			"1": [60, 60, 4, 70, 0, imagesCache.asteroid1],
			"2": [125, 125, 4, 60, 0, imagesCache.asteroid2],
			"3": [80, 80, 4, 70, 1, imagesCache.asteroid3],
			"4": [40, 40, 4, 70, 2, imagesCache.asteroid4],
			"5": [70, 70, 4, 70, 3, imagesCache.asteroid5],
			"6": [60, 60, 4, 70, 4, imagesCache.asteroid6],
			"7": [40, 40, 4, 70, 0, imagesCache.asteroid4],
			"8": [200, 200, 4, 70, 0, imagesCache.asteroid7],
			"9": [80, 80, 8, 100, rand, imagesCache.asteroid8],
			"10": [100, 100, 8, 70, 6, imagesCache.asteroid9],
		};
		return new Asteroid(...typeOptionsMap[type]);
	}
}

class PowerUp extends InGameObject {
	constructor(effect, img) {
		super(4, 60);
		this.width = 60;
		this.height = 40;
		this.x = 1200;
		this.y = Math.floor(Math.random() * (800 - this.height));
		this.speed = 700;
		this.movingType = 0;
		this.img = img;
		this.hitRadius = 22.5;
		this.effect = effect;
	}
}

class PowerUpFactory {
	static createPowerUp(type) {
		let typeOptionsMap = {
			"0": [0, imagesCache.powerUp0],
			"1": [1, imagesCache.powerUp1],
			"2": [2, imagesCache.powerUp2],
			"3": [3, imagesCache.powerUp3],
		};
		return new PowerUp(...typeOptionsMap[type]);
	}
}

class Slime extends InGameObject {
	constructor(img) {
		super(8, 40);
		this.width = 70;
		this.height = 70;
		this.x = 0 - this.width;
		this.y = Math.floor(Math.random() * (800 - this.height));
		this.speed = 700;
		this.movingType = 5;
		this.img = img;
		this.hitRadius = 35;
	}
	crash() {
		this.img = imagesCache.slimeCrash;
		this.speed = 250;
	}
}

class SlimeFactory {
	static createSlime() {
		return new Slime(imagesCache.slime);
	}
}

function loadResources() {
	const context = new (window.AudioContext || window.webkitAudioContext)();
	const resolved = [];
	const promises = [];
	const audio = {
		theme: ['sounds/space_jazz.mp3', music],
		click: ['sounds/click.mp3', sfx],
		start: ['sounds/start.mp3', sfx],
		impact: ['sounds/impact.mp3', sfx],
		gameOver: ['sounds/game_over.mp3', music],
		levelCompleted: ['sounds/level_completed.mp3', music],
		slow: ['sounds/slow.mp3', sfx],
		flash: ['sounds/flash.mp3', sfx],
		invisibility: ['sounds/invisibility.mp3', sfx],
		extraLife: ['sounds/extra_life.mp3', sfx],
	};
	const images = {
		alien: 'img/alien.png',
		ship: 'img/ship.png',
		life: 'img/life.png',
		invisibility: 'img/invisibility.png',
		slimed: 'img/slimed.png',
		asteroid0: 'img/ast0.png',
		asteroid1: 'img/ast1.png',
		asteroid2: 'img/ast2.png',
		asteroid3: 'img/ast3.png',
		asteroid4: 'img/ast4.png',
		asteroid5: 'img/ast5.png',
		asteroid6: 'img/ast6.png',
		asteroid7: 'img/ast7.png',
		asteroid8: 'img/ast8.png',
		asteroid9: 'img/ast9.png',
		powerUp0: 'img/pu0.png',
		powerUp1: 'img/pu1.png',
		powerUp2: 'img/pu2.png',
		powerUp3: 'img/pu3.png',
		slime: 'img/slime.png',
		slimeCrash: 'img/slime_crash.png',
		world1: 'img/maps/level1.jpg',
		world2: 'img/maps/level2.jpg',
		world3: 'img/maps/level3.jpg',
		world4: 'img/maps/level4.jpg',
		world5: 'img/maps/level5.jpg',
		world6: 'img/maps/level6.jpg',
		world7: 'img/maps/level7.jpg',
		world8: 'img/maps/level8.jpg',
		world9: 'img/maps/level9.jpg',
		world10: 'img/maps/level10.jpg',
		world11: 'img/maps/level11.jpg',
		world12: 'img/maps/level12.jpg',
		world13: 'img/maps/level13.jpg',
		world14: 'img/maps/level14.jpg',
		world15: 'img/maps/level15.jpg',
		world16: 'img/maps/level16.jpg',
	}

	class Sound {
		constructor(context, buffer, type) {
			this.context = context;
			this.buffer = buffer;
			this.type = type;
		}
		init(volume) {
			this.gainNode = this.context.createGain();
			this.source = this.context.createBufferSource();
			this.source.buffer = this.buffer;
			this.source.connect(this.gainNode);
			this.gainNode.connect(this.context.destination);
			this.gainNode.gain.setValueAtTime(volume, this.context.currentTime);
		}
		play() {
			const playerData = JSON.parse(localStorage.getItem('player'));
			let volume;
			switch (this.type) {
				case sfx:
					volume = playerData.sfxVolume;
					break;
				case music:
					volume = playerData.musicVolume;
					break;
			}
			this.init(volume);
			this.source.start(this.context.currentTime);
			this.playing = true;
		}
		stop() {
			this.gainNode.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.5);
			this.source.stop(this.context.currentTime + 0.5);
			this.playing = false;
		}
	}

	function makeRequest(method, url, type) {
		return new Promise(function (resolve, reject) {
			let xhr = new XMLHttpRequest();
			xhr.open(method, url);
			xhr.responseType = type;
			xhr.onload = function () {
				if (this.status >= 200 && this.status < 300) {
					resolve(xhr.response);
				} else {
					reject({
						status: this.status,
						statusText: xhr.statusText
					});
				}
			};
			xhr.onerror = function () {
				reject({
					status: this.status,
					statusText: xhr.statusText
				});
			};
			xhr.send();
		});
	}

	function loadImages() {
		for (key in images) {
			let newKey = key;
			let newPromise = loadImage(images[key]);
			promises.push(newPromise);
			newPromise.then(function (value) {
				imagesCache[newKey] = value;
				updateProgress(newPromise);
			}, function (reason) {
				console.log('promise rejected: failed to load images');
			});
		}
		function loadImage(url) {
			return new Promise((resolve, reject) => {
				let img = new Image();
				img.src = url;
				img.onload = function () {
					resolve(img);
				};
				img.onerror = function (reason) {
					reject(console.log('failed to load:' + ' ' + url));
				};
			})
		}
	}

	function loadSounds() {
		for (key in audio) {
			loadSound(...audio[key], key);
		}
	}
	function loadSound(url, type, key) {
		const newPromise = makeRequest('get', url, 'arraybuffer');
		newPromise.then(value => {
			updateProgress(newPromise);
			const subPromise = context.decodeAudioData(value, function (decodedData) {
				audioBuffer[key] = new Sound(context, decodedData, type);
				updateProgress(subPromise);
				if (Object.values(audioBuffer).length === Object.values(audio).length) {
					completeLoading();
				}
			});
			promises.push(subPromise);
		}, reason => {
			console.log(reason);
		});
		promises.push(newPromise);
	}

	function completeLoading() {
		const completed = Promise.all(promises);
		completed.then(function (value) {
			openScreen('main');
		}, function (reason) {
			console.log('promise rejected: failed to load resources');
		});
	}

	function updateProgress(newResolved) {
		resolved.push(newResolved);
		const step = 1 / promises.length * 100;
		const newWidth = resolved.length * step;
		document.querySelector('.progress-bar__status').style.width = newWidth + '%';
	}

	loadImages();
	loadSounds();
}

function openScreen(id) {
	if (!id) return
	audioBuffer.click.play();
	const controller = document.querySelector('.controller');
	controller.classList.remove('active');
	if (id === 'game' && isTouchScreen === true) {
		controller.classList.add('active');
	}
	document.querySelectorAll('.game-screen').forEach(element => element.classList.remove('active'));
	document.getElementById(id).classList.add('active');
	setAccess();
}

function addWorlds() {
	const worlds = JSON.parse(localStorage.getItem('player')).worlds;
	const worldsElement = document.querySelector('.worlds');
	for (key in worlds) {
		const img = parseInt(key) + 1 + 's';
		worldsElement.insertAdjacentHTML('beforeend', `
         <div data-world="${parseInt(key)}" class="worlds__item">
            <img src="img/maps/level${img}.jpg" alt="" class="worlds__img">
            <div class="worlds__caption">World ${parseInt(key) + 1}</div>
            <div class="worlds__score">High score: <span class="worlds__best">${worlds[key]}</span></div>
         </div>
	   `);
	}
}

function setAccess() {
	const playerData = JSON.parse(localStorage.getItem('player'));
	const worlds = document.getElementById('worlds').querySelectorAll('.worlds__item');
	for (let i = 0; i < worlds.length; i++) {
		if (playerData.worlds[i - 1] >= 300 || playerData.worlds[i - 1] === undefined) {
			worlds[i].classList.remove('inactive');
		} else {
			worlds[i].classList.add('inactive');
		}
		worlds[i].querySelector('.worlds__best').innerHTML = playerData.worlds[i];
	}
	document.getElementById('music').value = playerData.musicVolume * 100;
	document.getElementById('sfx').value = playerData.sfxVolume * 100;
}

function changeVolume() {
	const newMusicVolume = document.getElementById('music').value / 100;
	const newSfxVolume = document.getElementById('sfx').value / 100;
	const playerData = JSON.parse(localStorage.getItem('player'));
	playerData.musicVolume = newMusicVolume;
	playerData.sfxVolume = newSfxVolume;
	localStorage.setItem('player', JSON.stringify(playerData));
}

function setPlayerData() {
	if (JSON.parse(localStorage.getItem('player'))) return
	let playerData = {
		worlds: {
			"0": 0,
			"1": 0,
			"2": 0,
			"3": 0,
			"4": 0,
			"5": 0,
			"6": 0,
			"7": 0,
			"8": 0,
			"9": 0,
			"10": 0,
			"11": 0,
		},
		musicVolume: 0.6,
		sfxVolume: 0.2,
	}
	localStorage.setItem('player', JSON.stringify(playerData));
}
function setNewWorlds() {
	let playerData = JSON.parse(localStorage.getItem('player'));
	if (Object.keys(playerData.worlds).length === 16) return
	let newWorlds = {
		"12": 0,
		"13": 0,
		"14": 0,
		"15": 0,
	}
	playerData.worlds = Object.assign(playerData.worlds, newWorlds);
	localStorage.setItem('player', JSON.stringify(playerData));
}

function createWorld(world) {
	openScreen('game');
	document.querySelector('.canvas').innerHTML = '';
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	canvas.width = 1200;
	canvas.height = 800;
	document.querySelector('.canvas').appendChild(canvas);
	audioBuffer.theme.play();
	return WorldFactory.createWorld(world, ctx);
}

document.addEventListener('DOMContentLoaded', function (event) {
	setPlayerData();
	setNewWorlds();
	addWorlds();
	loadResources();
	window.addEventListener('touchstart', function () {
		isTouchScreen = true;
	})
	document.addEventListener('click', function (event) {
		if (event.target.classList.contains('screen__btn')) {
			openScreen(event.target.dataset.screen);
		}
		if (event.target.classList.contains('gameRestart')) {
			createWorld(event.target.dataset.world);
		}
	});
	document.getElementById('worlds').querySelectorAll('.worlds__item').forEach(element => {
		element.addEventListener('click', function (event) {
			createWorld(event.target.closest('.worlds__item').dataset.world);
		})
	})
	document.querySelectorAll('.screen__range').forEach(element => {
		element.addEventListener('input', changeVolume, false);
	})
});
