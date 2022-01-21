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
const extraLifeImg = document.getElementById('life');
const scoreElement = document.getElementById('score');
const player = 'player';
const levels = document.querySelectorAll('.level__item');

let bg = {
   width: 1250,
   img: new Image(),
   scroll: 0,
};

let asteroids = [];
let powerUps = [];
let powerUpInterval = 15;
let speedRatio = 1;
let baseAsteroidsOnScreen = 3;
let asteroidsInterval = 0;
let spawnAsteroids = true;
let extraLife;
let score;
let powerUpCounter;
let asteroidsOnScreen;
let lastTime;
let isGameOver;
let isInvisible;
let slowTimeOut;
let gameLevel;
let renderFrame = true;
let endless;

let playerProgress = [1, 0, 0, 0, 0, 0];

class Object {
   constructor(x, y, width, height, speed, frames, frameSpeed, hitRadius) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.speed = speed;
      this.img = new Image();
      this.frame = 1;
      this.frames = frames;
      this.frameSpeed = frameSpeed;
      this.frameTime = 0;
      this.hitRadius = hitRadius;
   }
   getRandomY() {
      this.y = Math.floor(Math.random() * (800 - this.height));
   }
   getRandomDestY() {
      this.destY = Math.floor(Math.random() * (800 - this.height));
   }
   getRandomSpeed() {
      this.speed = Math.floor(500 + Math.random() * (900 + 1 - 500)) * speedRatio;
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

let resolved = [];
let promises = [];
function updateResolving(newResolved) {
   console.log(resolved.length + '  ' + promises.length);
   resolved.push(newResolved);
   let step = 1 / promises.length * 100;
   //resolved.push(promise);
   // if (resolved.length === promises.length) {
   //    resolved = [];
   //    promises = [];
   // }
   return resolved.length * step;
}
function updateAudioLoading(percentage) {
   let newWidth = percentage;
   document.querySelector('.progress-bar__status').style.width = newWidth + '%';
   if (newWidth === 100) {
      setTimeout(() => openScreen('gameStartScreen'), 300)
   }
}
class Buffer {
   constructor(context, urls) {
      this.context = context;
      this.urls = urls;
      this.buffer = [];
   }
   loadSound(url, index) {
      let thisBuffer = this;
      let newPromise = makeRequest('get', url, 'arraybuffer');
      promises.push(newPromise);
      newPromise.then(function (value) {
         thisBuffer.context.decodeAudioData(value, function (buffer) {
            console.log(index);
            thisBuffer.buffer[index] = buffer;
            updateAudioLoading(updateResolving(newPromise));
         });
      }, function (reason) {
         console.log(reason);
      });
   };
   loadAll() {
      this.urls.forEach((url, index) => {
         this.loadSound(url, index);
      })
      let thisBuffer = this;
      //console.log(promises.length);
      //console.log(this.urls.length);
      let completed = Promise.all(promises);
      completed.then(function (value) {
         updateResolving(100);
         thisBuffer.loaded();
      }, function (reason) {
         console.log(reason); // Ошибка!
      });
   }
   loaded() {
      saveSounds();
      openScreen('gameStartScreen');
   }
   getSoundByIndex(index) {
      return this.buffer[index];
   }
}
class Sound {
   constructor(context, buffer) {
      this.context = context;
      this.buffer = buffer;
   }
   init() {
      this.gainNode = this.context.createGain();
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.context.destination);
      this.gainNode.gain.setValueAtTime(0.8, this.context.currentTime);
   }
   play() {
      this.init();
      this.source.start(this.context.currentTime);
   }
   stop() {
      var ct = this.context.currentTime + 0.5;
      this.gainNode.gain.exponentialRampToValueAtTime(0.001, ct);
      this.source.stop(ct);
   }
}
let context;
let bufferLoader;

let audio;
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
let sounds = [];

function loadSounds() {
   openScreen('loadingScreen');
   for (key in audioUrls) {
      sounds.push(audioUrls[key]);
   }
   context = new (window.AudioContext || window.webkitAudioContext)();
   bufferLoader = new Buffer(context, sounds);
   bufferLoader.loadAll();
}

function saveSounds() {
   audio = {
      theme: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.theme))),
      click: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.click))),
      start: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.start))),
      impact: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.impact))),
      gameOver: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.gameOver))),
      levelCompleted: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.levelCompleted))),
      slow: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.slow))),
      flash: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.flash))),
      invisibility: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.invisibility))),
      extraLife: new Sound(context, bufferLoader.getSoundByIndex(getSoundId(audioUrls.extraLife))),
   }
}

function getSoundId(sound) {
   for (let i = 0; i < sounds.length; i++) {
      if (sounds[i] === sound) return i
   }
}

bg.img.src = 'img/maps/level1.jpg';
let ship = new Object(20, 385, 50, 50, 500, 6, 40, 17);

function init() {
   //audio.theme.stop();
   //audio.start.play();
   audio.theme.play();
   reset();
   bg.width = 1250;
   bg.img.src = 'img/maps/level' + gameLevel + '.jpg';
   if (gameLevel === 6) {
      bg.width = 1600;
   }
   openScreen('gamePlayScreen');
   lastTime = Date.now();
   spawnAsteroids = false;
   setTimeout(() => spawnAsteroids = true, 2000);
   renderFrame = true;
   loop();
}

function loop() {
   let now = Date.now();
   let dt = (now - lastTime) / 1000.0;
   update(dt);
   updateSprite(dt, ship);
   asteroids.forEach(element => updateSprite(dt, element))
   powerUps.forEach(element => updateSprite(dt, element))
   render();
   lastTime = now;
   if (renderFrame === true) {
      requestAnimFrame(loop);
   }
};

function updateSprite(dt, object) {
   object.frameTime += dt;
   if (object.frameTime > object.frameSpeed / 1000) {
      object.frame++
      object.frameTime = 0;
   }
   if (object.frame > object.frames) object.frame = 1;
}

function renderObject(object) {
   if (Array.isArray(object)) {
      object.forEach(element => {
         ctx.drawImage(element.img, (element.frame * element.width) - element.width, 0, element.width, element.height, element.x, element.y, element.width, element.height);
      })
   } else {
      ctx.drawImage(object.img, (object.frame * object.width) - object.width, 0, object.width, object.height, object.x, object.y, object.width, object.height);
   }
}

function render() {
   ctx.clearRect(0, 0, canvas.width, canvas.height);
   ctx.drawImage(bg.img, bg.scroll, 0, bg.width - bg.scroll, canvas.height, 0, 0, bg.width - bg.scroll, canvas.height);
   ctx.drawImage(bg.img, 0, 0, bg.scroll, canvas.height, bg.width - bg.scroll, 0, bg.scroll, canvas.height);
   renderObject(asteroids);
   renderObject(ship);
   renderObject(powerUps);
}

function update(dt) {
   moveShip(dt);
   moveObject(dt, asteroids);
   moveObject(dt, powerUps);
   moveBg(dt);
   removeObject(asteroids);
   removeObject(powerUps);
   if (checkCollision(ship, asteroids)) gameOver();
   if (checkCollision(ship, powerUps)) powerUp(powerUps[0].type);
   generateAsteroid(dt);
}

function powerUp(type) {
   switch (type) {
      case 0: slowAsteroids(); break;
      case 1: flash(); break;
      case 2: invisibility(5000); break;
      case 3: addExtraLife();
   }
   powerUps = [];
}

function slowAsteroids() {
   playSound(audio.slow);
   if (speedRatio === 1) asteroids.forEach(element => element.speed *= 0.5);
   speedRatio = 0.5;
   clearTimeout(slowTimeOut);
   slowTimeOut = setTimeout(() => speedRatio = 1, 10000);
}

function flash() {
   playSound(audio.flash);
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

function invisibility(time) {
   playSound(audio.invisibility);
   isInvisible = true;
   ship.img.src = 'img/invisibility.png';
   setTimeout(() => {
      isInvisible = false;
      ship.img.src = 'img/ship.png';
   }, time);
}

function addExtraLife() {
   playSound(audio.extraLife);
   if (extraLife === 1) return
   extraLife = 1;
   extraLifeImg.classList.remove('hide');
}

function updateScore() {
   score++;
   powerUpCounter++;
   scoreElement.innerHTML = score;
   if (powerUpCounter === powerUpInterval) generatePowerUp();
   asteroidsOnScreen = Math.floor(score / 50) + baseAsteroidsOnScreen;
   if (score >= 300 && endless === false) levelCompleted();
}

function levelCompleted() {
   isGameOver = true;
   playerProgress[gameLevel] = 1;
   console.log(playerProgress);
   saveLocalStorageItem(player, playerProgress);
   setTimeout(() => {
      openScreen('worlCompletedScreen');
      renderFrame = false;
      playSound(audio.levelCompleted);
   }, 500);
}

function gameOver() {
   if (isInvisible === true) return
   playSound(audio.impact);
   if (extraLife > 0) {
      extraLife--;
      extraLifeImg.classList.add('hide');
      invisibility(2000);
      return
   }
   isGameOver = true;
   ship.img.src = 'img/alien.png';
   document.getElementById('scoreGameOver').innerHTML = score;
   setTimeout(() => {
      openScreen('gameOverScreen');
      playSound(audio.gameOver);
      stopSound(audio.theme);
      renderFrame = false;
   }, 1000);
}

function reset() {
   let oldFlash = document.querySelector('.flash');
   if (oldFlash) oldFlash.remove();
   ship.img.src = 'img/ship.png';
   isGameOver = false;
   isInvisible = false;
   asteroidsOnScreen = baseAsteroidsOnScreen;
   ship.x = 20;
   ship.y = 385;
   asteroids = [];
   powerUps = [];
   score = 0;
   scoreElement.innerHTML = score;
   powerUpCounter = 0;
   extraLife = 0;
}

function checkCollision(entity, entities) {
   if (isGameOver === true) return
   let collissions = 0;
   entities.forEach(element => {
      if (Math.hypot(Math.abs((entity.x + entity.width / 2) - (element.x + element.width / 2)), Math.abs((entity.y + entity.height / 2) - (element.y + element.height / 2))) <= entity.hitRadius + element.hitRadius) collissions++
   })
   if (collissions > 0) return true
}

function generatePowerUp() {
   let newPowerUp = new Object(1200, 0, 60, 40, 700, 4, 60, 22.5);
   let type = Math.floor(Math.random() * 4);
   newPowerUp.y = newPowerUp.getRandomY();
   newPowerUp.img.src = 'img/pu' + type + '.png';
   newPowerUp.type = type;
   powerUps.push(newPowerUp);
   powerUpCounter = 0;
}

function generateAsteroid(dt) {
   if (spawnAsteroids === false) return
   asteroidsInterval += dt;
   if (asteroids.length > asteroidsOnScreen - 1) return
   if (asteroidsInterval < 0.1) return
   asteroidsInterval = 0;
   let newAsteroid;
   let type = Math.floor(Math.random() * (gameLevel + 1));
   switch (type) {
      case 0:
         newAsteroid = new Object(1200, 0, 100, 100, 0, 8, 60, 49);
         newAsteroid.level = 1;
         newAsteroid.getRandomY();
         newAsteroid.getRandomSpeed();
         break;
      case 1:
         newAsteroid = new Object(1200, 0, 60, 60, 0, 4, 70, 29);
         newAsteroid.level = 1;
         newAsteroid.getRandomY();
         newAsteroid.getRandomSpeed();
         break;
      case 2:
         newAsteroid = new Object(1200, 0, 125, 125, 0, 4, 60, 61.5);
         newAsteroid.level = 1;
         newAsteroid.getRandomY();
         newAsteroid.getRandomSpeed();
         break;
      case 3:
         newAsteroid = new Object(1200, 0, 80, 80, 0, 4, 70, 39);
         newAsteroid.level = 2;
         newAsteroid.y = newAsteroid.getRandomY();
         newAsteroid.getRandomSpeed();
         newAsteroid.getRandomDestY();
         newAsteroid.dY = newAsteroid.y - newAsteroid.destY;
         break;
      case 4:
         newAsteroid = new Object(1200, 0, 40, 40, 0, 4, 70, 15);
         newAsteroid.level = 3;
         newAsteroid.y = Math.abs(newAsteroid.getRandomY() - (newAsteroid.width * 2));

         newAsteroid.speed = newAsteroid.getRandomSpeed();
         break;
      case 5:
         newAsteroid = new Object(1200, 0, 70, 70, 0, 4, 70, 29);
         newAsteroid.level = 4;
         newAsteroid.getRandomY();
         newAsteroid.getRandomSpeed();
         break;
      case 6:
         newAsteroid = new Object(1200, 0, 60, 60, 0, 4, 70, 29);
         newAsteroid.level = 5;
         newAsteroid.getRandomSpeed();
         newAsteroid.y = 0;
         break;
   }
   newAsteroid.img.src = 'img/ast' + type + '.png';
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

function moveObject(dt, object) {
   object.forEach(element => {
      element.x -= element.speed * dt;
      if (element.level) {
         switch (element.level) {
            case 2: element.y -= element.speed / (canvas.width / element.dY) * dt; break;
            case 3: element.y += Math.abs(element.x * dt / 10); break;
            case 4: element.y += 5 * Math.sin(element.x / 2.5 * dt); break;
            // case 5: element.y += Math.atan(element.x / dt - 600) * 5;
            case 5: element.y += 500 * Math.tan(element.x / 1200 * dt);
         }
      }
   })
}

function moveShip(dt) {
   if (isGameOver === true) return
   if (input.isDown('LEFT') || input.isDown('a')) {
      ship.x -= ship.speed * dt;
      if (ship.x < 0) ship.x = 0;
   }
   if (input.isDown('RIGHT') || input.isDown('d')) {
      ship.x += ship.speed * dt;
      if (ship.x > canvas.width - ship.width) ship.x = canvas.width - ship.width;
   }
   if (input.isDown('DOWN') || input.isDown('s')) {
      ship.y += ship.speed * dt;
      if (ship.y > canvas.height - ship.height) ship.y = canvas.height - ship.height;
   }
   if (input.isDown('UP') || input.isDown('w')) {
      ship.y -= ship.speed * dt;
      if (ship.y < 0) ship.y = 0;
   }
   if (input.isDown('SPACE')) {
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
   playerProgress = getLocalStorageItem(player);
   for (let i = 0; i < levels.length; i++) {
      if (playerProgress[i] === 0) {
         levels[i].classList.add('inactive');
      } else {
         levels[i].classList.remove('inactive');
      }
   }
   if (playerProgress[6] === 1) {
      document.querySelector('.endless').classList.remove('inactive');
   } else {
      document.querySelector('.endless').classList.add('inactive');
   }
}

document.addEventListener('DOMContentLoaded', function (event) {
   if (getLocalStorageItem(player) === null) {
      saveLocalStorageItem(player, playerProgress);
   } else {
      playerProgress = getLocalStorageItem(player);
   }
   loadSounds();
   document.addEventListener('click', function (event) {
      if (event.target.classList.contains('game-screen__btn')) {
         audio.click.play();
         console.log(audio.theme)
         audio.theme.play();
         openScreen(event.target.dataset.screen);
      }
      if (event.target.classList.contains('gameRestart')) {
         audio.click.play();
         init();
      }
   });
   levels.forEach(element => {
      element.addEventListener('click', function (event) {
         endless = false;
         if (document.getElementById('endless').checked) endless = true;
         openScreen('gamePlayScreen');
         gameLevel = parseInt(this.dataset.level);
         audio.click.play();
         init();
      })
   })
});
