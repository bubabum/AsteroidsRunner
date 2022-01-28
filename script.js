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
         case 32:
            key = 'SPACE'; break;
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
      setKey(e, true);
   });
   document.addEventListener('keyup', function (e) {
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

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 1200;
canvas.height = 800;
document.getElementById('gamePlayScreen').appendChild(canvas);
const player = 'player';
const extraLifeImg = document.getElementById('life');
const scoreElement = document.getElementById('score');

let imagesCache = {};
let audioBuffer = {};

class Sound {
   constructor(context, buffer) {
      this.context = context;
      this.buffer = buffer;
   }
   init(volume) {
      this.gainNode = this.context.createGain();
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.context.destination);
      this.gainNode.gain.setValueAtTime(volume, this.context.currentTime);
   }
   play(volume) {
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
function loadResources() {
   let audioUrls = {
      theme: 'sounds/space_jazz.mp3',
      click: 'sounds/click.mp3',
      start: 'sounds/start.mp3',
      impact: 'sounds/impact.mp3',
      gameOver: 'sounds/game_over.mp3',
      levelCompleted: 'sounds/level_completed.mp3',
      slow: 'sounds/slow.mp3',
      flash: 'sounds/flash.mp3',
      invisibility: 'sounds/invisibility.mp3',
      extraLife: 'sounds/extra_life.mp3',
   };
   let imagesUrls = {
      alien: 'img/alien.png',
      ship: 'img/ship.png',
      invisibility: 'img/invisibility.png',
      asteroid0: 'img/ast0.png',
      asteroid1: 'img/ast1.png',
      asteroid2: 'img/ast2.png',
      asteroid3: 'img/ast3.png',
      asteroid4: 'img/ast4.png',
      asteroid5: 'img/ast5.png',
      asteroid6: 'img/ast6.png',
      asteroid7: 'img/ast7.png',
      asteroid8: 'img/ast8.png',
      powerUp0: 'img/pu0.png',
      powerUp1: 'img/pu1.png',
      powerUp2: 'img/pu2.png',
      powerUp3: 'img/pu3.png',
      world1: 'img/maps/level1.jpg',
      world2: 'img/maps/level2.jpg',
      world3: 'img/maps/level3.jpg',
      world4: 'img/maps/level4.jpg',
      world5: 'img/maps/level5.jpg',
      world6: 'img/maps/level6.jpg',
   }
   let urls = [];

   class Buffer {
      constructor(context, urls) {
         this.context = context;
         this.urls = urls;
         this.buffer = [];
         this.index = 0;
      }
      loadSound(url, index) {
         let thisBuffer = this;
         let newPromise = makeRequest('get', url, 'arraybuffer');
         newPromise.then(value => {
            updateProgress(newPromise);
            let subPromise = thisBuffer.context.decodeAudioData(value, function (decodedData) {
               thisBuffer.buffer[index] = decodedData;
               updateProgress(subPromise);
               thisBuffer.index++;
               if (thisBuffer.index === thisBuffer.urls.length) {
                  onDecoding();
               }
            });
            promises.push(subPromise);
         }, reason => {
            console.log(reason);
         });
         promises.push(newPromise);
      }
      getSoundByIndex(index) {
         return this.buffer[index];
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
      for (key in imagesUrls) {
         let newKey = key;
         let newPromise = loadImage(imagesUrls[key]);
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
      for (key in audioUrls) {
         urls.push(audioUrls[key]);
      }
      context = new (window.AudioContext || window.webkitAudioContext)();
      bufferLoader = new Buffer(context, urls);
      bufferLoader.urls.forEach(element => bufferLoader.loadSound(element, bufferLoader.urls.indexOf(element)));
   }

   function updateProgress(newResolved) { // визначаємо крок для progress bar
      resolved.push(newResolved);
      let step = 1 / promises.length * 100;
      let newWidth = resolved.length * step;
      document.querySelector('.progress-bar__status').style.width = newWidth + '%';
   }

   function onDecoding() {
      for (key in audioUrls) {
         let newKey = key;
         audioBuffer[newKey] = new Sound(context, bufferLoader.getSoundByIndex(urls.indexOf(audioUrls[key])));
      }
      let completed = Promise.all(promises);
      completed.then(function (value) {
         openScreen('gameStartScreen');
      }, function (reason) {
         console.log('promise rejected: failed to load resources');
      });
   }

   let context;
   let bufferLoader;
   let resolved = [];
   let promises = [];
   openScreen('loadingScreen');
   loadImages();
   loadSounds();
}

class World {
   constructor(minAsteroidType, maxAsteroidType, speedMultiplier, darkness, background, world) {
      this.minAsteroidType = minAsteroidType;
      this.maxAsteroidType = maxAsteroidType;
      this.speedMultiplier = speedMultiplier;
      this.darkness = darkness;
      this.background = BackgroundFactory.createBackground(background);
      this.world = world;
      this.spaceship = SpaceshipFactory.createSpaceship();
      this.asteroids = [];
      this.powerUps = [];
      this.powerUpInterval = 15;
      this.speedRatio = 1;
      this.baseAsteroidsOnScreen = 3;
      this.asteroidsInterval = 0;
      this.spawnAsteroids = false;
      this.renderFrame = true;
      this.score = 0;
      this.powerUpCounter = 0;
      this.asteroidsOnScreen = this.baseAsteroidsOnScreen;
      this.isGameOver = false;
      this.lastTime = Date.now();
      this.slowTimeOut;
      this.playerData = getLocalStorageItem(player);
   }
   loop() {
      let now = Date.now();
      let dt = (now - this.lastTime) / 1000.0;
      this.update(dt);
      this.render();
      this.lastTime = now;
      if (this.renderFrame === true) {
         requestAnimFrame(() => this.loop());
      }
   }
   render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.background.render();
      this.asteroids.forEach(element => element.render());
      this.powerUps.forEach(element => element.render());
      this.spaceship.render();
   }
   update(dt) {
      this.moveObjects(dt)
      this.updateSprites(dt)
      this.generateAsteroid(dt);
      this.removeObjects(this.asteroids);
      this.removeObjects(this.powerUps);
      this.addDarkness();
      if (this.isGameOver === true) return;
      this.spaceship.moveSpaceship(dt);
      if (this.spaceship.checkCollision(this.asteroids)) {
         this.gameOver();
      }
      if (this.spaceship.checkCollision(this.powerUps)) {
         switch (this.powerUps[0].effect) {
            case 0:
               audioBuffer.slow.play(this.playerData.sfxVolume);
               this.slowAsteroids();
               break;
            case 1:
               audioBuffer.flash.play(this.playerData.sfxVolume);
               this.flash();
               break;
            case 2:
               audioBuffer.invisibility.play(this.playerData.sfxVolume);
               this.spaceship.invisibility(5000);
               break;
            case 3:
               audioBuffer.extraLife.play(this.playerData.sfxVolume);
               this.spaceship.addExtraLife();
               break;
         }
         this.powerUps = [];
      }
   }
   updateSprites(dt) {
      this.spaceship.updateSprite(dt);
      this.asteroids.forEach(element => element.updateSprite(dt));
      this.powerUps.forEach(element => element.updateSprite(dt));
   }
   moveObjects(dt) {
      this.asteroids.forEach(element => element.move(dt));
      this.powerUps.forEach(element => element.move(dt));
      this.background.move(dt);
   }
   updateScore() {
      this.score++;
      this.powerUpCounter++;
      scoreElement.innerHTML = this.score;
      if (this.powerUpCounter === this.powerUpInterval) {
         this.generatePowerUp();
      }
      this.asteroidsOnScreen = Math.floor(this.score / 50) + this.baseAsteroidsOnScreen;
      if (this.score >= 300 && this.playerData.worlds[this.world] < 300) {
         this.isGameOver = true;
         this.playerData.worlds[this.world] = this.score;
         saveLocalStorageItem(player, this.playerData);
         setTimeout(() => this.worldCompleted(), 500)
      }
   }
   worldCompleted() {
      openScreen('worlCompletedScreen');
      scoreElement.innerHTML = 0;
      this.renderFrame = false;
      audioBuffer.theme.stop();
      audioBuffer.levelCompleted.play(this.playerData.musicVolume);
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
      let newAsteroid = AsteroidFactory.createAsteroid(Math.floor(this.minAsteroidType + Math.random() * (this.maxAsteroidType + 1 - this.minAsteroidType)));
      newAsteroid.speed *= this.speedRatio * this.speedMultiplier;
      this.asteroids.push(newAsteroid);
   }
   generatePowerUp() {
      let type = Math.floor(Math.random() * 4);
      let newPowerUp = PowerUpFactory.createPowerUp(type);
      this.powerUps.push(newPowerUp);
      this.powerUpCounter = 0;
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
      audioBuffer.impact.play(this.playerData.sfxVolume);
      if (this.spaceship.extraLife > 0) {
         this.spaceship.extraLife--;
         extraLifeImg.classList.add('hide');
         this.spaceship.invisibility(2000);
         return;
      }
      this.isGameOver = true;
      this.spaceship.img = imagesCache.alien;
      document.getElementById('scoreGameOver').innerHTML = this.score;
      if (this.score > this.playerData.worlds[this.world]) {
         this.playerData.worlds[this.world] = this.score;
         saveLocalStorageItem(player, this.playerData);
      }
      setTimeout(() => {
         openScreen('gameOverScreen');
         document.querySelector('.gameRestart').dataset.world = this.world;
         scoreElement.innerHTML = 0;
         audioBuffer.theme.stop();
         audioBuffer.gameOver.play(this.playerData.musicVolume);
         this.renderFrame = false;
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
   flash() {
      let flash = document.createElement('div');
      flash.classList.add('flash');
      document.body.append(flash);
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
      let darkness = document.createElement('div');
      darkness.classList.add('darkness');
      document.body.append(darkness);
      setTimeout(() => darkness.remove(), 5000);
   }
}

class WorldFactory {
   static createWorld(type) {
      let typeOptionsMap = {
         "0": [0, 1, 1, false, 1, 0],
         "1": [0, 2, 1, false, 2, 1],
         "2": [0, 3, 1, false, 3, 2],
         "3": [0, 4, 1, false, 4, 3],
         "4": [0, 5, 1, false, 5, 4],
         "5": [0, 6, 1, false, 6, 5],
         "6": [7, 7, 1.5, false, 7, 6],
         "7": [0, 6, 1, true, 7, 7],
         "8": [8, 8, 0.5, false, 7, 8],
         "9": [3, 6, 1, true, 7, 9],
         "10": [9, 9, 1, false, 7, 10],
         "11": [0, 9, 1, false, 7, 11],
      };
      return new World(...typeOptionsMap[type]);
   }
}

class Background {
   constructor(width, img) {
      this.width = width;
      this.img = img;
      this.scroll = 0;
   }
   move(dt) {
      this.scroll += 200 * dt;
      if (this.scroll > this.width) {
         this.scroll = 0;
      }
   }
   render() {
      ctx.drawImage(this.img, this.scroll, 0, this.width - this.scroll, canvas.height, 0, 0, this.width - this.scroll, canvas.height);
      ctx.drawImage(this.img, 0, 0, this.scroll, canvas.height, this.width - this.scroll, 0, this.scroll, canvas.height);
   }
}

class BackgroundFactory {
   static createBackground(type) {
      let randomIndex = Math.floor(Math.random() * 6);
      let randomBackround;
      switch (randomIndex) {
         case 0: randomBackround = imagesCache.world1; break;
         case 1: randomBackround = imagesCache.world2; break;
         case 2: randomBackround = imagesCache.world3; break;
         case 3: randomBackround = imagesCache.world4; break;
         case 4: randomBackround = imagesCache.world5; break;
         case 5: randomBackround = imagesCache.world6; break;
      }
      let width = 1250;
      if (randomBackround === imagesCache.world6) {
         width = 1600;
      }
      let typeOptionsMap = {
         "1": [1250, imagesCache.world1],
         "2": [1250, imagesCache.world2],
         "3": [1250, imagesCache.world3],
         "4": [1250, imagesCache.world4],
         "5": [1250, imagesCache.world5],
         "6": [1600, imagesCache.world6],
         "7": [width, randomBackround],
      };
      return new Background(...typeOptionsMap[type]);
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
         case 1: this.y -= this.speed / (canvas.width / this.dY) * dt; break;
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
      }
   }
   render() {
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
      this.speed = 600;
      this.img = imagesCache.ship;
      this.hitRadius = 17;
      this.extraLife = 0;
      this.isInvisible = false;
      this.invisibilityTimeOut;
   }
   moveSpaceship(dt) {
      if (input.isDown('LEFT') || input.isDown('a')) {
         this.x -= this.speed * dt;
         if (this.x < 0) this.x = 0;
      }
      if (input.isDown('RIGHT') || input.isDown('d')) {
         this.x += this.speed * dt;
         if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;
      }
      if (input.isDown('DOWN') || input.isDown('s')) {
         this.y += this.speed * dt;
         if (this.y > canvas.height - this.height) this.y = canvas.height - this.height;
      }
      if (input.isDown('UP') || input.isDown('w')) {
         this.y -= this.speed * dt;
         if (this.y < 0) this.y = 0;
      }
      if (input.isDown('SPACE')) {
      }
   }
   checkCollision(objectsArr) {
      let collissions = 0;
      objectsArr.forEach(element => {
         if (Math.hypot(Math.abs((this.x + this.width / 2) - (element.x + element.width / 2)), Math.abs((this.y + this.height / 2) - (element.y + element.height / 2))) <= this.hitRadius + element.hitRadius) {
            collissions++;
         }
      })
      if (collissions > 0) return true
   }
   addExtraLife() {
      if (this.extraLife === 1) return
      this.extraLife = 1;
      extraLifeImg.classList.remove('hide');
   }
   invisibility(time) {
      this.isInvisible = true;
      this.img = imagesCache.invisibility;
      clearTimeout(this.invisibilityTimeOut);
      this.invisibilityTimeOut = setTimeout(() => this.removeInvisibility(), time);
   }
   removeInvisibility() {
      this.isInvisible = false;
      this.img = imagesCache.ship;
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
      this.x = canvas.width;
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
      };
      return new Asteroid(...typeOptionsMap[type]);
   }
}

class PowerUp extends InGameObject {
   constructor(effect, img) {
      super(4, 60);
      this.width = 60;
      this.height = 40;
      this.x = canvas.width;
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

function getLocalStorageItem(item) {
   return JSON.parse(localStorage.getItem(item));
}
function saveLocalStorageItem(item, data) {
   localStorage.setItem(item, JSON.stringify(data));
}

function openScreen(id) {
   if (!id) return
   document.querySelectorAll('.game-screen').forEach(element => element.classList.remove('active'));
   document.getElementById(id).classList.add('active');
   setAccess();
}

function setAccess() {
   let playerData = getLocalStorageItem(player);
   let worlds = document.getElementById('worlds').querySelectorAll('.worlds__item');
   for (let i = 0; i < worlds.length; i++) {
      if (playerData.worlds[i - 1] >= 50 || playerData.worlds[i - 1] === undefined) {
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
   let newMusicVolume = document.getElementById('music').value / 100;
   let newSfxVolume = document.getElementById('sfx').value / 100;
   let playerData = getLocalStorageItem(player);
   playerData.musicVolume = newMusicVolume;
   playerData.sfxVolume = newSfxVolume;
   saveLocalStorageItem(player, playerData);
}

function setPlayerData() {
   if (getLocalStorageItem(player)) return
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
   saveLocalStorageItem(player, playerData);
}

function createWorld(world) {
   openScreen('gamePlayScreen');
   let newWorld = WorldFactory.createWorld(world);
   newWorld.loop();
}

document.addEventListener('DOMContentLoaded', function (event) {
   setPlayerData();
   loadResources();
   let playerData = getLocalStorageItem(player);
   document.addEventListener('click', function (event) {
      if (event.target.classList.contains('screen__btn')) {
         audioBuffer.click.play(playerData.sfxVolume);
         openScreen(event.target.dataset.screen);
      }
      if (event.target.classList.contains('gameRestart')) {
         audioBuffer.click.play(playerData.sfxVolume);
         audioBuffer.theme.play(playerData.musicVolume);
         createWorld(event.target.dataset.world);
      }
   });
   document.getElementById('worlds').querySelectorAll('.worlds__item').forEach(element => {
      element.addEventListener('click', function (event) {
         audioBuffer.click.play(playerData.sfxVolume);
         audioBuffer.theme.play(playerData.musicVolume);
         createWorld(event.target.closest('.worlds__item').dataset.world);
      })
   })
   document.querySelectorAll('.screen__range').forEach(element => {
      element.addEventListener('input', changeVolume, false);
   })
});
