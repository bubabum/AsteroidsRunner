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

function init(world) {

   class World {
      constructor() {
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
         this.invisibilityTimeOut;
         this.playerData = getLocalStorageItem(player);
      }
      loop() {
         let now = Date.now();
         let dt = (now - lastTime) / 1000.0;
         this.update(dt);
         this.spaceship.updateSprite(dt);
         this.asteroids.forEach(element => element.updateSprite(dt));
         this.powerUps.forEach(element => element.updateSprite(dt));
         this.render();
         this.lastTime = now;
         if (this.renderFrame === true) {
            requestAnimFrame(loop);
         }
      }
      render() {
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.drawImage(bg.img, bg.scroll, 0, bg.width - bg.scroll, canvas.height, 0, 0, bg.width - bg.scroll, canvas.height);
         ctx.drawImage(bg.img, 0, 0, bg.scroll, canvas.height, bg.width - bg.scroll, 0, bg.scroll, canvas.height);
         this.asteroids.forEach(element => element.render());
         this.powerUps.forEach(element => element.render());
         this.spaceship.render();
      }
      update() {
         this.spaceship.moveSpaceship(dt);
         this.asteroids.forEach(element => element.move(dt));
         this.powerUps.forEach(element => element.move(dt));
         moveBg(dt);
         this.removeObjects(asteroids);
         this.removeObjects(powerUps);
         if (this.spaceship.checkCollision(this.asteroids)) {
            gameOver();
         }
         if (this.spaceship.checkCollision(this.powerUps)) {
            this.spaceship.powerUp(this.powerUps[0].effect);
         }
         generateAsteroid(dt);
      }
      removeObjects() {
         for (let i = 0; i < object.length; i++) {
            if (object[i].x < 0 - object[i].width) {
               object.splice(i, 1);
               if (isGameOver === false) updateScore();
            }
         }
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
         this.speed = 500;
         this.img = imagesCache.ship;
         this.hitRadius = 17;
         this.isInvisible = false;
         this.extraLife = 0;
      }
      moveSpaceship(dt) {
         if (isGameOver === true) return
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
         if (isGameOver === true) return
         let collissions = 0;
         objectsArr.forEach(element => {
            if (Math.hypot(Math.abs((this.x + this.width / 2) - (element.x + element.width / 2)), Math.abs((this.y + this.height / 2) - (element.y + element.height / 2))) <= this.hitRadius + element.hitRadius) {
               collissions++;
            }
         })
         if (collissions > 0) return true
      }
      powerUp(effect) {
         switch (effect) {
            case 0: this.slowAsteroids(); break;
            case 1: this.flash(); break;
            case 2: this.invisibility(5000); break;
            case 3: this.addExtraLife(); break;
         }
         powerUps = [];
      }
      slowAsteroids() {
         audioBuffer.slow.play(playerData.sfxVolume);
         if (speedRatio === 1) {
            asteroids.forEach(element => element.speed *= 0.5);
         }
         speedRatio = 0.5;
         clearTimeout(slowTimeOut);
         slowTimeOut = setTimeout(() => speedRatio = 1, 10000);
      }
      flash() {
         audioBuffer.flash.play(playerData.sfxVolume);
         let oldFlash = document.querySelector('.flash');
         if (oldFlash) oldFlash.remove();
         let flash = document.createElement('div');
         flash.classList.add('flash');
         document.body.append(flash);
         score += asteroids.length;
         updateScore();
         asteroids = [];
         spawnAsteroids = false;
         setTimeout(() => spawnAsteroids = true, 2000);
      }
      addExtraLife() {
         audioBuffer.extraLife.play(playerData.sfxVolume);
         if (this.extraLife === 1) return
         this.extraLife = 1;
         extraLifeImg.classList.remove('hide');
      }
      invisibility(time) {
         audioBuffer.invisibility.play(playerData.sfxVolume);
         this.isInvisible = true;
         this.img = imagesCache.invisibility;
         clearTimeout(invisibilityTimeOut);
         invisibilityTimeOut = setTimeout(this.removeInvisibility(), time);
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
         this.speed = Math.floor(500 + Math.random() * (900 + 1 - 500)) * speedRatio;
         this.movingType = movingType;
         this.img = img;
         this.hitRadius = (width / 2) - 1;
         this.destY = Math.floor(Math.random() * (800 - this.height));
         this.dY = this.y - this.destY;
      }
   }

   class AsteroidFactory {
      static createAsteroid(type) {
         let typeOptionsMap = {
            "0": [100, 100, 8, 60, 0, imagesCache.asteroid0],
            "1": [60, 60, 4, 70, 0, imagesCache.asteroid1],
            "2": [125, 125, 4, 60, 0, imagesCache.asteroid2],
            "3": [80, 80, 4, 70, 1, imagesCache.asteroid3],
            "4": [40, 40, 4, 70, 2, imagesCache.asteroid4],
            "5": [70, 70, 4, 70, 3, imagesCache.asteroid5],
            "6": [60, 60, 4, 70, 4, imagesCache.asteroid6],
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

   const extraLifeImg = document.getElementById('life');
   const scoreElement = document.getElementById('score');

   let spaceship = SpaceshipFactory.createSpaceship();
   let asteroids = [];
   let powerUps = [];
   let powerUpInterval = 15;
   let speedRatio = 1;
   let baseAsteroidsOnScreen = 3;
   let asteroidsInterval = 0;
   let spawnAsteroids = false;
   let renderFrame = true;
   let extraLife = 0;
   let score = 0;
   let powerUpCounter = 0;
   let asteroidsOnScreen = baseAsteroidsOnScreen;
   let isGameOver = false;
   //let isInvisible = false;
   let lastTime = Date.now();
   let slowTimeOut;
   let invisibilityTimeOut;

   let playerData = getLocalStorageItem(player);

   let oldFlash = document.querySelector('.flash');
   if (oldFlash) {
      oldFlash.remove();
   }

   scoreElement.innerHTML = score;

   let bg = {
      scroll: 0,
      width: 1250,
   };
   switch (world) {
      case 1: bg.img = imagesCache.world1; break;
      case 2: bg.img = imagesCache.world2; break;
      case 3: bg.img = imagesCache.world3; break;
      case 4: bg.img = imagesCache.world4; break;
      case 5: bg.img = imagesCache.world5; break;
      case 6: {
         bg.img = imagesCache.world6;
         bg.width = 1600;
      }
         break;
   }

   if (audioBuffer.theme.playing === true) {
      audioBuffer.theme.stop();
   }
   audioBuffer.start.play(playerData.sfxVolume);
   audioBuffer.theme.play(playerData.musicVolume);
   openScreen('gamePlayScreen');

   setTimeout(startSpawn, 2000);

   loop();

   function startSpawn() {
      spawnAsteroids = true;
   }

   function loop() {
      let now = Date.now();
      let dt = (now - lastTime) / 1000.0;
      update(dt);
      spaceship.updateSprite(dt);
      asteroids.forEach(element => element.updateSprite(dt));
      powerUps.forEach(element => element.updateSprite(dt));
      renderAll();
      lastTime = now;
      if (renderFrame === true) {
         requestAnimFrame(loop);
      }
   };

   function renderAll() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bg.img, bg.scroll, 0, bg.width - bg.scroll, canvas.height, 0, 0, bg.width - bg.scroll, canvas.height);
      ctx.drawImage(bg.img, 0, 0, bg.scroll, canvas.height, bg.width - bg.scroll, 0, bg.scroll, canvas.height);
      asteroids.forEach(element => element.render());
      powerUps.forEach(element => element.render());
      spaceship.render();
   }

   function update(dt) {
      spaceship.moveSpaceship(dt);
      //moveShip(dt);
      //spaceship.move();
      asteroids.forEach(element => element.move(dt));
      powerUps.forEach(element => element.move(dt));
      // moveObject(dt, asteroids);
      // moveObject(dt, powerUps);
      moveBg(dt);
      removeObject(asteroids);
      removeObject(powerUps);
      if (spaceship.checkCollision(asteroids)) {
         gameOver();
      }
      if (spaceship.checkCollision(powerUps)) {
         spaceship.powerUp(powerUps[0].effect);
      }
      generateAsteroid(dt);
   }

   function updateScore() {
      score++;
      powerUpCounter++;
      scoreElement.innerHTML = score;
      if (powerUpCounter === powerUpInterval) {
         generatePowerUp();
      }
      asteroidsOnScreen = Math.floor(score / 50) + baseAsteroidsOnScreen;
      if (score >= 10 && playerData.endlessMode === false) {
         isGameOver = true;
         if (world < 6) {
            playerData.baseWorlds[world] = 1;
         } else {
            playerData.baseWorldsCompleted = true;
         }
         saveLocalStorageItem(player, playerData);
         setTimeout(worldCompleted, 500)
      }
   }

   function worldCompleted() {
      openScreen('worlCompletedScreen');
      renderFrame = false;
      audioBuffer.theme.stop();
      audioBuffer.levelCompleted.play(playerData.musicVolume);
   }

   function gameOver() {
      if (isInvisible === true) return
      audioBuffer.impact.play(playerData.sfxVolume);
      if (extraLife > 0) {
         extraLife--;
         extraLifeImg.classList.add('hide');
         invisibility(2000);
         return;
      }
      isGameOver = true;
      spaceship.img = imagesCache.alien;
      document.getElementById('scoreGameOver').innerHTML = score;
      if (score > playerData.highScore[world - 1]) {
         playerData.highScore[world - 1] = score;
         saveLocalStorageItem(player, playerData);
      }
      setTimeout(endGame, 1000);
   }

   function endGame() {
      openScreen('gameOverScreen');
      document.querySelector('.gameRestart').dataset.world = world;
      audioBuffer.theme.stop();
      audioBuffer.gameOver.play(playerData.musicVolume);
      renderFrame = false;
   }

   // function checkCollision(entity, entities) {
   //    if (isGameOver === true) return
   //    let collissions = 0;
   //    entities.forEach(element => {
   //       if (Math.hypot(Math.abs((entity.x + entity.width / 2) - (element.x + element.width / 2)), Math.abs((entity.y + entity.height / 2) - (element.y + element.height / 2))) <= entity.hitRadius + element.hitRadius) collissions++
   //    })
   //    if (collissions > 0) return true
   // }

   function generatePowerUp() {
      let type = Math.floor(Math.random() * 4);
      let newPowerUp = PowerUpFactory.createPowerUp(type);
      powerUps.push(newPowerUp);
      powerUpCounter = 0;
   }

   function generateAsteroid(dt) {
      if (spawnAsteroids === false) return
      asteroidsInterval += dt;
      if (asteroids.length > asteroidsOnScreen - 1) return
      if (asteroidsInterval < 0.1) return
      asteroidsInterval = 0;
      let newAsteroid = AsteroidFactory.createAsteroid(4);
      asteroids.push(newAsteroid);
   }

   function removeObject(object) {
      for (let i = 0; i < object.length; i++) {
         if (object[i].x < 0 - object[i].width) {
            object.splice(i, 1);
            if (isGameOver === false) updateScore();
         }
      }
   }

   function moveBg(dt) {
      bg.scroll += 200 * dt;
      if (bg.scroll > bg.width) {
         bg.scroll = 0;
      }
   }

   // function moveObject(dt, object) {
   //    object.forEach(element => {
   //       element.x -= element.speed * dt;
   //       if (element.level) {
   //          switch (element.level) {
   //             case 2: element.y -= element.speed / (canvas.width / element.dY) * dt; break;
   //             case 3: element.y += Math.abs(element.x * dt / 10); break;
   //             case 4: element.y += 5 * Math.sin(element.x / 2.5 * dt); break;
   //             // case 5: element.y += Math.atan(element.x / dt - 600) * 5;
   //             case 5: element.y += 500 * Math.tan(element.x / 1200 * dt);
   //          }
   //       }
   //    })
   // }

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
   let baseWorlds = document.getElementById('baseWorlds').querySelectorAll('.worlds__item');
   for (let i = 0; i < baseWorlds.length; i++) {
      if (playerData.baseWorlds[i] === 0) {
         baseWorlds[i].classList.add('inactive');
      } else {
         baseWorlds[i].classList.remove('inactive');
         baseWorlds[i].querySelector('.worlds__best').innerHTML = playerData.highScore[i];
      }
   }
   if (playerData.baseWorldsCompleted === true) {
      document.querySelector('.endless').classList.remove('inactive');
      document.getElementById('specialWorlds').classList.remove('inactive');
   } else {
      document.querySelector('.endless').classList.add('inactive');
      document.getElementById('specialWorlds').classList.add('inactive');
   }
   document.getElementById('music').value = playerData.musicVolume * 100;
   document.getElementById('sfx').value = playerData.sfxVolume * 100;
   document.getElementById('endless').checked = playerData.endlessMode;
}

function changeEndlessMode() {
   let playerData = getLocalStorageItem(player);
   let newMode = document.getElementById('endless').checked;
   console.log(newMode);
   playerData.endlessMode = newMode;
   saveLocalStorageItem(player, playerData);
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
      baseWorlds: [1, 0, 0, 0, 0, 0],
      highScore: [0, 0, 0, 0, 0, 0],
      baseWorldsCompleted: false,
      endlessMode: false,
      specialWorlds: [],
      musicVolume: 0.6,
      sfxVolume: 0.2,
   }
   saveLocalStorageItem(player, playerData);
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
         init(parseInt(event.target.dataset.world));
      }
   });
   document.getElementById('baseWorlds').querySelectorAll('.worlds__item').forEach(element => {
      element.addEventListener('click', function (event) {
         audioBuffer.click.play(playerData.sfxVolume);
         openScreen('gamePlayScreen');
         init(parseInt(this.dataset.world));
      })
   })
   document.querySelectorAll('.screen__range').forEach(element => {
      element.addEventListener('input', changeVolume, false);
   })
   document.getElementById('endless').addEventListener('input', changeEndlessMode, false);
});
