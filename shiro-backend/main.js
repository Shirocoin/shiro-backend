const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 720,
  backgroundColor: '#88cfff',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  // Add parent to attach to the game-container div
  parent: 'game-container',
  // Center the game horizontally and vertically
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);
if (window.Telegram && window.Telegram.WebApp) {
    Telegram.WebApp.ready();
}

let shiro;
let cursors;
let coins;
let score = 0;
let scoreText;
let shiroHitbox;
let coinDropEvent;
let dropSpeed = 450; // Velocidad inicial de caída aumentada más para garantizar monedas suficientes
let gameTime = 0;

// 🕓 TEMPORIZADOR con estrellas
let timeBar;
let timeStars = [];
let timeMax = 90; // segundos de duración
let currentTime = 0;
let gameOver = false;
let soundEffects = {};
let startButton;
let restartButton;

function preload() {
  // Set handler for loading errors
  this.load.on('loaderror', function(file) {
    console.error('Error loading asset:', file.src);
  });

  // Cargar el fondo
  this.load.image('background', 'asset/images/background_base.png');
  
  // Cargar el personaje Shiro
  this.load.image('shiro', 'asset/images/shiro.png');

  // Cargamos las monedas pequeñas (rutas corregidas)
  this.load.image('bitcoin', 'asset/bitcoin_medium.png');
  this.load.image('ethereum', 'asset/ethereum_medium.png');
  this.load.image('solana', 'asset/solana_medium.png');
  this.load.image('shiro_coin', 'asset/shiro_medium.png');

  // Cargamos efectos visuales
  this.load.image('hit', 'asset/shiro_hit_effect.png');
  this.load.image('star', 'asset/images/star.png');

  // Botones táctiles personalizados
  this.load.image('arrow_left', 'asset/arrow_left_cat.png');
  this.load.image('arrow_right', 'asset/arrow_right_cat.png');
  this.load.image('start_icon', 'asset/start_cat.png');
  this.load.image('restart_icon', 'asset/restart_cat.png');

  // 🎵 Cargamos sonidos
  this.load.audio('positive', 'asset/coin_positive.ogg');
  this.load.audio('negative', 'asset/coin_negative.ogg');
  this.load.audio('music', 'asset/background_loop.mp3');
  this.load.audio('game_over', 'asset/game_over.ogg');
}

function create() {
  setupTouchControls(this);
  gameOver = false;
  currentTime = 0;
  score = 0;
  coinDropEvent = this.time.addEvent({
    delay: 1000,
    callback: dropCoin,
    callbackScope: this,
    loop: true
  });

  // Agregar fondo
  const background = this.add.image(240, 360, 'background');
  background.setDisplaySize(480, 720);
  
  // Crear y configurar Shiro
  shiro = this.physics.add.sprite(240, 710, 'shiro');
  shiro.setOrigin(0.5, 1);
  shiro.setDisplaySize(70, 70);
  shiro.setCollideWorldBounds(true);
  
  // Crear hitbox para detección de colisiones
  shiroHitbox = this.physics.add.sprite(shiro.x, shiro.y - 50, null);
  shiroHitbox.setSize(40, 40);   // tamaño de colisión ideal
  shiroHitbox.setVisible(false); // lo hace invisible
  shiroHitbox.body.allowGravity = false;
  shiroHitbox.setImmovable(true);

  // Ajustar propiedades de física de Shiro
  shiro.setBounce(0);
  shiro.setDragX(1000);      // frena enseguida al soltar tecla
  shiro.setMaxVelocity(400); // velocidad máxima permitida
  shiro.setVelocity(0);
  shiro.setGravityY(0);

  // Ajustar el tamaño del cuerpo físico de Shiro
  this.time.delayedCall(0, () => {
    shiro.body.setSize(60, 60, true); // el true fuerza el cambio
    shiro.body.setOffset(20, 40);
  });

  // Configurar grupo de monedas y detección de colisiones
  coins = this.physics.add.group();
  this.physics.add.overlap(shiroHitbox, coins, (sh, coin) => collectCoin.call(this, sh, coin), null, this);
  
  // Configurar controles
  cursors = this.input.keyboard.createCursorKeys();

  // Configurar evento para caída de monedas - frecuencia moderada
  coinDropEvent = this.time.addEvent({
    delay: 1300, // Intervalo inicial más corto para que aparezcan monedas más rápidamente
    callback: dropCoin,
    callbackScope: this,
    loop: true
  });

  // Mostrar puntuación
  scoreText = this.add.text(20, 60, 'Puntos: 0', {
    fontSize: '24px',
    fill: '#fff',
    fontFamily: 'Arial',
    stroke: '#000',
    strokeThickness: 2
  });
  
  // 🟡 Crear barra de estrellas (una por cada 15 segundos)
  timeBar = this.add.group();
  for (let i = 0; i < 6; i++) {
    let star = this.add.image(120 + i * 60, 30, 'star')
      .setAlpha(0.2)
      .setDisplaySize(40, 40)  // tamaño exacto
      .setDepth(10);           // asegúrate que está por encima del fondo
    
    timeStars.push(star);
  }

  // Precargar efectos de sonido
  soundEffects = {
    positive: this.sound.add('positive'),
    negative: this.sound.add('negative'),
    gameOver: this.sound.add('game_over')
  };

  // Iniciar música de fondo
  this.sound.play('music', { loop: true, volume: 0.1 });

  // 📱 Botones táctiles para móviles con iconos
  if (this.sys.game.device.input.touch) {
    const leftButton = this.add.image(60, 660, 'arrow_left')
      .setDisplaySize(80, 80)
      .setInteractive();

    const rightButton = this.add.image(420, 660, 'arrow_right')
      .setDisplaySize(80, 80)
      .setInteractive();

    leftButton.on('pointerdown', () => { shiro.setVelocityX(-200); });
    rightButton.on('pointerdown', () => { shiro.setVelocityX(200); });

    leftButton.on('pointerup', () => { shiro.setVelocityX(0); });
    rightButton.on('pointerup', () => { shiro.setVelocityX(0); });

    leftButton.on('pointerout', () => { shiro.setVelocityX(0); });
    rightButton.on('pointerout', () => { shiro.setVelocityX(0); });
  }

  // 🎮 Botón START
  startButton = this.add.image(240, 360, 'start_icon')
    .setDisplaySize(120, 120)
    .setInteractive()
    .setDepth(100);

  this.physics.pause();
  coinDropEvent.paused = true;
  this.sound.pauseAll();

  startButton.on('pointerdown', () => {
    startButton.setVisible(false);
    this.physics.resume();
    coinDropEvent.paused = false;
    this.sound.resumeAll();
  });
}

function update() {
  if (gameOver) return;
  if (cursors.left.isDown || moveLeft) {
    shiro.x -= 10;
  } else if (cursors.right.isDown || moveRight) {
    shiro.x += 10;
  }

  // Control de movimiento horizontal
  if (cursors.left.isDown && shiro.x > 45) {
    shiro.setVelocityX(-200);
  } else if (cursors.right.isDown && shiro.x < 435) {
    shiro.setVelocityX(200);
  } else {
    shiro.setVelocityX(0);
  }

  // 🧱 Límite visual duro a izquierda y derecha
  if (shiro.x > 435) {
    shiro.setVelocityX(0);
    shiro.x = 435;
  }
  if (shiro.x < 45) {
    shiro.setVelocityX(0);
    shiro.x = 45;
  }

  // 🎯 Actualizar posición del hitbox invisible
  shiroHitbox.x = shiro.x;
  shiroHitbox.y = shiro.y - 50;

  // Aumentar dificultad de forma muy gradual
  if (!gameOver) {
    gameTime += this.game.loop.delta;

    if (gameTime >= 4000) { // Cada 3 segundos para una progresión extremadamente suave
      gameTime = 0;

      // ⚡ Aumentamos velocidad de caída muy levemente
      dropSpeed += 0.3; // Incremento mínimo por nivel

      // Reducimos delay entre oleadas de monedas de forma muy gradual
      // Mínima reducción basada en el tiempo transcurrido
      const timeBasedReduction = Math.min(40 + (currentTime / 20) * 5, 60);
      let newDelay = Math.max(coinDropEvent.delay - timeBasedReduction, 20000); // Mínimo mucho más alto

      // Solo en etapas muy avanzadas, aceleramos levemente
      if (currentTime > 20) { // Mucho más tarde en el juego
        newDelay = Math.max(newDelay - 10, 800); // Mínimo muy razonable
      }

      coinDropEvent.reset({
        delay: newDelay,
        callback: dropCoin,
        callbackScope: this,
        loop: true
      });
    }
  }

  // 🕓 TEMPORIZADOR de estrellas
  if (!gameOver) {
    currentTime += this.game.loop.delta / 1000;

    const secondsPerStar = timeMax / timeStars.length;

    for (let i = 0; i < timeStars.length; i++) {
      if (currentTime >= secondsPerStar * (i + 1)) {
        timeStars[i].setAlpha(1);
      }
    }

    // 🔴 Al alcanzar el tiempo total, se detiene
    if (currentTime >= timeMax && !gameOver) {
      gameOver = true;

      // Mostrar TODAS las estrellas (por seguridad)
      timeStars.forEach(star => star.setAlpha(1));

      // Parar música y reproducir sonido de fin de juego
      const musicSound = this.sound.get('music');
      if (musicSound) musicSound.stop(); // Solo detiene la música
      soundEffects.gameOver.play();

      // Espera 2000ms para que se escuche completamente el sonido de game over
      this.time.delayedCall(2000, () => {
        // Ocultar a Shiro
        shiro.setVisible(false);
        
        // Mostrar texto "GAME OVER" (una sola vez)
        this.add.text(120, 300, 'GAME OVER', {
          fontSize: '48px',
          fill: '#ff0000',
          fontFamily: 'Arial',
          stroke: '#000',
          strokeThickness: 3,
        }).setDepth(100);

        // Mostrar puntuación final
        this.add.text(180, 380, `TOTAL: ${score}`, {
          fontSize: '32px',
          fill: '#fff',
          fontFamily: 'Arial',
          stroke: '#000',
          strokeThickness: 2
        }).setDepth(100);

        // Pausar la física del juego
        this.physics.pause();
        
        // Detener la generación de monedas
        coinDropEvent.remove();
        // 🔁 Botón de REINICIAR
        restartButton = this.add.image(240, 520, 'restart_icon')
          .setDisplaySize(100, 100)
          .setInteractive()
          .setDepth(100);

        restartButton.on('pointerdown', () => {
          gameTime = 0;
          currentTime = 0;
          dropSpeed = 450;
          this.sound.stopAll();
          this.scene.restart();
        });

      }, null, this);
    }
  }
}

function dropCoin() {
  // Si el juego ha terminado, no generamos monedas
  if (gameOver) return; // Removido el retraso inicial de 5 segundos para que las monedas aparezcan desde el principio
  
  // Definir el ancho de Shiro para asegurar espacio suficiente para pasar
  const shiroWidth = 60; // ancho aproximado del hitbox
  
  // Espacio mínimo necesario para que Shiro pueda pasar entre monedas
  // Aumentamos drásticamente el espacio para garantizar rutas navegables
  const safeSpace = shiroWidth + 80; // Espacio muy ampliado para mejor jugabilidad
  
  // Ancho jugable total (40 a 440 píxeles)
  const totalPlayableWidth = 400; // 440 - 40
  
  // Número de monedas a generar - DENSIDAD MODERADA
  // Base inicial moderada para asegurar que aparezcan monedas
  let coinCount = 3; // Comenzamos con 2 monedas desde el inicio
  
  // Incremento gradual de la dificultad basado en el tiempo de juego
  if (currentTime > 30) { 
    coinCount = 5; // 3 monedas tras 20 segundos
  }
  
  if (currentTime > 60) { 
    coinCount = 6; // 4 monedas tras 45 segundos
  }
  
  // Máximo absoluto para mantener la dificultad jugable
  coinCount = Math.min(coinCount, 5); // Moderado a 5 (antes era 4)
  
  // Dividimos la pantalla en segmentos más amplios para garantizar caminos navegables
  const maxPossibleCoins = 11; // Reducimos el número de segmentos
  const segmentWidth = totalPlayableWidth / maxPossibleCoins;
  
  // Creamos patrón garantizado con caminos navegables
  // Reservamos algunos segmentos que NUNCA tendrán monedas (caminos seguros)
  const safePathCount = 3; // Caminos seguros garantizados
  const safePaths = [];
  
  // Distribuimos caminos seguros uniformemente
  for (let i = 0; i < safePathCount; i++) {
    // Calculamos la posición óptima para los caminos seguros
    const safeSegment = Math.floor((maxPossibleCoins / (safePathCount + 1)) * (i + 1));
    safePaths.push(safeSegment);
  }
  
  // Array con todos los segmentos disponibles (0 a maxPossibleCoins-1)
  // excluyendo los caminos seguros
  let availableSegments = [];
  for (let i = 0; i < maxPossibleCoins; i++) {
    if (!safePaths.includes(i)) {
      availableSegments.push(i);
    }
  }
  
  // Mezclamos los segmentos para seleccionar aleatoriamente
  Phaser.Utils.Array.Shuffle(availableSegments);
  
  // Tomamos solo los segmentos que necesitamos
  const selectedSegments = availableSegments.slice(0, Math.min(coinCount, availableSegments.length));
  
  // Ordenamos los segmentos para mantener el orden original
  // Esto garantiza que las monedas caigan distribuidas por toda la pantalla
  selectedSegments.sort((a, b) => a - b);
  
  let distributedPositions = [];
  
  // Para cada segmento seleccionado, colocamos una moneda en una posición aleatoria
  for (const segment of selectedSegments) {
    // Calculamos los límites del segmento actual, con margen adicional
    // Usamos márgenes más amplios para garantizar que estén bien separadas
    const segmentStart = 40 + (segment * segmentWidth) + 5; // Margen desde el inicio
    const segmentEnd = 40 + ((segment + 1) * segmentWidth) - 15; // Mayor margen al final
    
    // Elegimos una posición centrada en el segmento para evitar aglomeración
    const position = Math.floor(segmentStart + (segmentEnd - segmentStart) * 0.5 + 
                               (Math.random() - 0.5) * (segmentEnd - segmentStart) * 0.6);
    distributedPositions.push(position);
  }
  
  // Generamos las monedas en las posiciones calculadas CON ESPACIADO TEMPORAL
  for (let i = 0; i < distributedPositions.length; i++) {
    this.time.delayedCall(i * 500, () => {
      const x = distributedPositions[i];
      const typeRng = Math.random();
      let randomType;

      if (typeRng < 0.25) {
        randomType = 'shiro_coin';
      } else {
        randomType = Phaser.Utils.Array.GetRandom(['bitcoin', 'ethereum', 'solana']);
      }

      const coin = coins.create(x, 0, randomType);
      coin.setVelocityY(dropSpeed);
      coin.setDisplaySize(30, 30);
      coin.setData('type', randomType);
    }, null, this);
  }
  
  // SEGUNDA OLEADA: dispersa una por una
  if (currentTime > 10 && Math.random() < 0.35) {
    const positions = Phaser.Utils.Array.Shuffle([60, 120, 180, 240, 300, 360, 420]).slice(0, 2);
    positions.forEach((position, i) => {
      this.time.delayedCall(500 + i * 400, () => {
        if (gameOver) return;

        const typeRng = Math.random();
        let randomType = typeRng < 0.5 ? 'shiro_coin' : Phaser.Utils.Array.GetRandom(['bitcoin', 'ethereum', 'solana']);

        const coin = coins.create(position, 0, randomType);
        coin.setVelocityY(dropSpeed);
        coin.setDisplaySize(30, 30);
        coin.setData('type', randomType);
      }, null, this);
    });
  }
  
  // TERCERA OLEADA: dispersa también
  if (currentTime > 30 && Math.random() < 0.15) {
    const positions = Phaser.Utils.Array.Shuffle([80, 160, 240, 320, 400]).slice(0, 2);
    positions.forEach((position, i) => {
      this.time.delayedCall(1000 + i * 400, () => {
        if (gameOver) return;

        let randomType = Math.random() < 0.6 ? 'shiro_coin' :
          Phaser.Utils.Array.GetRandom(['bitcoin', 'ethereum', 'solana']);

        const coin = coins.create(position, 0, randomType);
        coin.setVelocityY(dropSpeed);
        coin.setDisplaySize(30, 30);
        coin.setData('type', randomType);
      }, null, this);
    });
  }
}

function collectCoin(shiro, coin) {
  const type = coin.getData('type');
  let pointsChange = 0;

  // Different behavior based on coin type
  if (type === 'shiro_coin') {
    // ✅ More points for Shiro coins - Good coin
    pointsChange = 2;
    score += pointsChange;
    scoreText.setText('Puntos: ' + score);

    // ✅ Positive sound effect
    soundEffects.positive.play();

    // ✨ Visual effect for positive coins
    const flash = this.add.image(coin.x, coin.y, 'hit');
    flash.setScale(0.1);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 0.3,
      duration: 300,
      onComplete: () => flash.destroy()
    });
  } else {
    // For other coins (bitcoin, ethereum, solana) - Bad coins
    pointsChange = -1;
    score += pointsChange; // This subtracts points since pointsChange is negative
    scoreText.setText('Puntos: ' + score);

    // Negative sound effect
    soundEffects.negative.play();
  }
  
  // Mostrar el cambio de puntuación sobre la moneda
  const pointsText = this.add.text(coin.x, coin.y, pointsChange > 0 ? '+'+pointsChange : pointsChange, {
    fontSize: '20px',
    fontFamily: 'Arial',
    fill: pointsChange > 0 ? '#00ff00' : '#ff0000',
    stroke: '#000',
    strokeThickness: 2
  });
  
  // Animación para el texto de puntos
  this.tweens.add({
    targets: pointsText,
    y: coin.y - 30,
    alpha: 0,
    duration: 800,
    onComplete: () => pointsText.destroy()
  });

  // Eliminar la moneda
  coin.destroy();
}
let moveLeft = false;
let moveRight = false;

function setupTouchControls(scene) {
  scene.input.on('pointerdown', (pointer) => {
    if (pointer.x < scene.sys.game.config.width / 2) moveLeft = true;
    else moveRight = true;
  });

  scene.input.on('pointerup', () => {
    moveLeft = false;
    moveRight = false;
  });
  }
  // -- COMIENZO DEL CÓDIGO A PEGAR (FUNCIÓN ENDGAME COMPLETA) --
 function endGame() {
  gameOver = true;
  if (restartButton) restartButton.setVisible(true);
  if (coinDropEvent) coinDropEvent.remove(false);

  if (typeof TelegramGameProxy !== 'undefined') {
    TelegramGameProxy.setScore(score, true, function() {
      console.log("✅ Score enviado a Telegram desde el juego");
    });
  } else {
    console.warn("TelegramGameProxy no disponible. ¿Estás ejecutando fuera de Telegram?");
  }
}
