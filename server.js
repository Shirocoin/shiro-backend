const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const GAME_SHORT_NAME = 'ShiroCoinDash';
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app";

if (!BOT_TOKEN) {
    console.error("ERROR: Token de Telegram Bot no configurado.");
    process.exit(1);
}

app.use(express.json());
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let gameMessages = new Map();

app.get("/", (req, res) => {
  console.log("Redirigiendo al juego...");
  res.redirect(GAME_URL);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});

// ✅ COMANDO /start CON REGISTRO AUTOMÁTICO DE SCORES DE PRUEBA
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'Jugador';
  
  console.log(`Comando /start del chat: ${chatId}, usuario: ${userId} (${userName})`);

  const keyboard = {
    inline_keyboard: [[{ text: '🎮 Jugar Shiro Coin', callback_game: {}}]]
  };

  try {
    const sentMessage = await bot.sendGame(chatId, GAME_SHORT_NAME, { 
      reply_markup: keyboard 
    });
    
    gameMessages.set(chatId, {
      messageId: sentMessage.message_id,
      userId: userId,
      userName: userName
    });
    
    console.log(`✅ Juego enviado. Chat: ${chatId}, MessageID: ${sentMessage.message_id}, Usuario: ${userName}`);
    
    // ✅ REGISTRAR SCORES DE PRUEBA AUTOMÁTICAMENTE PARA MÚLTIPLES USUARIOS
    setTimeout(async () => {
      const testScores = [
        { score: 5, name: userName },
        { score: 8, name: `${userName}_Test1` },
        { score: 12, name: `${userName}_Test2` },
        { score: 15, name: `${userName}_Test3` }
      ];
      
      for (const testData of testScores) {
        try {
          await bot.setGameScore(userId, testData.score, {
            chat_id: chatId,
            message_id: sentMessage.message_id,
            force: true,
            edit_message: true
          });
          console.log(`✅ Score de prueba registrado: ${testData.name} = ${testData.score}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo entre scores
        } catch (error) {
          console.log(`⚠️ Error score ${testData.score}:`, error.message);
        }
      }
    }, 3000); // Esperar 3 segundos después de enviar el juego
    
  } catch (error) {
    console.error("❌ Error enviando juego:", error.message);
    bot.sendMessage(chatId, "Error al iniciar el juego. Verifica la configuración del bot.");
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const userName = query.from.first_name || 'Jugador';
  
  console.log(`Callback query de ${userName} (ID: ${userId})`);

  if (query.game_short_name === GAME_SHORT_NAME) {
    const gameInfo = gameMessages.get(chatId);
    if (gameInfo) {
      gameInfo.currentUserId = userId;
      gameInfo.currentUserName = userName;
      gameMessages.set(chatId, gameInfo);
      
      // ✅ REGISTRAR SCORE AUTOMÁTICO CUANDO ALGUIEN CLICKEA JUGAR
      setTimeout(async () => {
        try {
          const randomScore = Math.floor(Math.random() * 20) + 1; // Score entre 1 y 20
          await bot.setGameScore(userId, randomScore, {
            chat_id: chatId,
            message_id: gameInfo.messageId,
            force: true,
            edit_message: true
          });
          console.log(`🎯 Score automático registrado: ${userName} = ${randomScore}`);
        } catch (error) {
          console.log(`⚠️ Error score automático:`, error.message);
        }
      }, 5000); // 5 segundos después de clickear jugar
    }
    
    console.log(`✅ Abriendo juego para usuario ${userId}: ${GAME_URL}`);
    await bot.answerCallbackQuery(query.id, { url: GAME_URL });
  } else {
    await bot.answerCallbackQuery(query.id, { text: "Juego no disponible." });
  }
});

// ✅ COMANDO /ranking SIMPLIFICADO
bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    console.log(`Comando /ranking solicitado por chat: ${chatId}, usuario: ${userId}`);
    
    try {
        const gameInfo = gameMessages.get(chatId);
        
        if (!gameInfo || !gameInfo.messageId) {
            await bot.sendMessage(chatId, 
                "❌ Primero debes jugar al menos una vez. Usa /start para empezar.");
            return;
        }

        console.log(`Obteniendo ranking con messageId: ${gameInfo.messageId}`);
        
        const highScores = await bot.getGameHighScores(userId, {
            chat_id: chatId,
            message_id: gameInfo.messageId
        });
        
        console.log(`Respuesta de Telegram:`, JSON.stringify(highScores, null, 2));
        
        let rankingText = "🏆 **RANKING SHIRO COIN** 🏆\n\n";
        
        if (highScores && highScores.length > 0) {
            const sortedScores = highScores.sort((a, b) => b.score - a.score);
            
            sortedScores.forEach((entry, index) => {
                const firstName = entry.user.first_name || 'Jugador';
                const lastName = entry.user.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();
                
                let medal = '';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';
                else medal = `${index + 1}.`;
                
                rankingText += `${medal} ${fullName}: **${entry.score}** puntos\n`;
            });
            
            rankingText += `\n📊 Total jugadores: ${highScores.length}`;
        } else {
            rankingText += "📭 Aún no hay puntuaciones registradas.\n";
            rankingText += "¡Sé el primero en establecer un récord!";
        }
        
        await bot.sendMessage(chatId, rankingText, { 
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id 
        });
        
        console.log("✅ Ranking enviado correctamente");
        
    } catch (error) {
        console.error("❌ Error obteniendo ranking:", error);
        
        let errorMessage = "❌ No pude obtener el ranking.";
        
        if (error.code === 400) {
            errorMessage += "\n\nAsegúrate de haber jugado al menos una vez usando /start";
        } else if (error.code === 403) {
            errorMessage += "\n\nPermisos insuficientes. Contacta al administrador.";
        }
        
        await bot.sendMessage(chatId, errorMessage);
    }
});

// ✅ COMANDO PARA SIMULAR SCORE MANUALMENTE
bot.onText(/\/testscore (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'Jugador';
    const score = parseInt(match[1]);
    
    console.log(`Comando /testscore: ${userName} quiere registrar ${score} puntos`);
    
    try {
        const gameInfo = gameMessages.get(chatId);
        
        if (!gameInfo || !gameInfo.messageId) {
            await bot.sendMessage(chatId, "❌ Usa /start primero");
            return;
        }

        await bot.setGameScore(userId, score, {
            chat_id: chatId,
            message_id: gameInfo.messageId,
            force: true,
            edit_message: true
        });
        
        console.log(`✅ Score manual registrado: ${userName} = ${score}`);
        await bot.sendMessage(chatId, `✅ Score de ${score} registrado para ${userName}!`);
        
    } catch (error) {
        console.error("❌ Error registrando score manual:", error);
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

bot.on('message', async (msg) => {
    if (msg.web_app_data) {
        console.log('📡 Datos recibidos de Mini App:', msg.web_app_data.data);
        try {
            const appData = JSON.parse(msg.web_app_data.data);
            
            if (appData.action === 'setGameScore' && appData.score !== undefined) {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                const score = parseInt(appData.score);
                const gameInfo = gameMessages.get(chatId);
                
                if (gameInfo && gameInfo.messageId) {
                    await bot.setGameScore(userId, score, {
                        chat_id: chatId,
                        message_id: gameInfo.messageId,
                        force: true,
                        edit_message: true
                    });
                    console.log(`✅ Score ${score} registrado via Mini App`);
                }
            }
        } catch (error) {
            console.error('❌ Error parseando datos de Mini App:', error);
        }
    }
    
    if (msg.game_score !== undefined) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = msg.from.first_name || 'Jugador';
        const score = msg.game_score;
        
        console.log(`🎯 Nueva puntuación registrada:`);
        console.log(`   Chat: ${chatId}`);
        console.log(`   Usuario: ${userName} (${userId})`);
        console.log(`   Puntuación: ${score}`);
        
        try {
            await bot.setGameScore(userId, score, {
                chat_id: chatId,
                message_id: msg.message_id,
                force: true,
                edit_message: true
            });
            console.log(`✅ Score ${score} actualizado en ranking con force: true`);
        } catch (error) {
            console.error(`❌ Error actualizando score:`, error.message);
        }
        
        if (msg.message_id) {
            const existing = gameMessages.get(chatId) || {};
            gameMessages.set(chatId, {
                ...existing,
                messageId: msg.message_id
            });
        }
    }
});

bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
🎮 **SHIRO COIN GAME**

**Comandos disponibles:**
/start - Iniciar el juego
/ranking - Ver top puntuaciones
/testscore [número] - Registrar score manualmente
/help - Mostrar esta ayuda

**Cómo jugar:**
🟡 Recoge monedas Shiro (+2 puntos)
🔴 Evita otras monedas (-1 punto)
⏰ Tienes 90 segundos
🎯 ¡Consigue la puntuación más alta!

**Ejemplo:** /testscore 25
    `;
    
    await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

bot.on('polling_error', (error) => {
  console.error(`❌ Error de polling: ${error.code} - ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`❌ E
