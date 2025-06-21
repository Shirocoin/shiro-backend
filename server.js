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
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  console.log(`Comando /start del chat: ${chatId}, usuario: ${userId}`);

  const keyboard = {
    inline_keyboard: [[{ text: '🎮 Jugar Shiro Coin', callback_game: {}}]]
  };

  try {
    const sentMessage = await bot.sendGame(chatId, GAME_SHORT_NAME, { 
      reply_markup: keyboard 
    });
    
    gameMessages.set(chatId, {
      messageId: sentMessage.message_id,
      userId: userId
    });
    
    console.log(`Juego enviado. Chat: ${chatId}, MessageID: ${sentMessage.message_id}, Usuario: ${userId}`);
    
  } catch (error) {
    console.error("Error enviando juego:", error.message);
    bot.sendMessage(chatId, "Error al iniciar el juego.");
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  
  console.log(`Callback query de usuario ${userId}`);

  if (query.game_short_name === GAME_SHORT_NAME) {
    console.log(`Abriendo juego para usuario ${userId}`);
    await bot.answerCallbackQuery(query.id, { url: GAME_URL });
  } else {
    await bot.answerCallbackQuery(query.id, { text: "Juego no disponible." });
  }
});

bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    console.log(`Comando /ranking solicitado por chat: ${chatId}, usuario: ${userId}`);
    
    try {
        const gameInfo = gameMessages.get(chatId);
        
        if (!gameInfo || !gameInfo.messageId) {
            await bot.sendMessage(chatId, "Primero debes jugar al menos una vez. Usa /start para empezar.");
            return;
        }

        console.log(`Obteniendo ranking con messageId: ${gameInfo.messageId}`);
        
        const highScores = await bot.getGameHighScores(userId, {
            chat_id: chatId,
            message_id: gameInfo.messageId
        });
        
        console.log(`Respuesta de Telegram:`, highScores);
        
        let rankingText = "🏆 RANKING SHIRO COIN 🏆\n\n";
        
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
                
                rankingText += `${medal} ${fullName}: ${entry.score} puntos\n`;
            });
        } else {
            rankingText += "Aún no hay puntuaciones registradas.\nSé el primero en establecer un récord!";
        }
        
        await bot.sendMessage(chatId, rankingText);
        
        console.log("Ranking enviado correctamente");
        
    } catch (error) {
        console.error("Error obteniendo ranking:", error);
        await bot.sendMessage(chatId, "No pude obtener el ranking.");
    }
});

bot.onText(/\/testscore (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'Jugador';
    const score = parseInt(match[1]);
    
    console.log(`Comando /testscore: ${userName} quiere registrar ${score} puntos`);
    
    try {
        const gameInfo = gameMessages.get(chatId);
        
        if (!gameInfo || !gameInfo.messageId) {
            await bot.sendMessage(chatId, "Usa /start primero");
            return;
        }

        await bot.setGameScore(userId, score, {
            chat_id: chatId,
            message_id: gameInfo.messageId,
            force: true,
            edit_message: true
        });
        
        console.log(`Score manual registrado: ${userName} = ${score}`);
        await bot.sendMessage(chatId, `Score de ${score} registrado para ${userName}!`);
        
    } catch (error) {
        console.error("Error registrando score manual:", error);
        await bot.sendMessage(chatId, `Error: ${error.message}`);
    }
});

bot.on('message', async (msg) => {
    if (msg.game_score !== undefined) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = msg.from.first_name || 'Jugador';
        const score = msg.game_score;
        
        console.log(`Nueva puntuación: Usuario ${userName} (${userId}), Puntuación: ${score}`);
        
        try {
            await bot.setGameScore(userId, score, {
                chat_id: chatId,
                message_id: msg.message_id,
                force: true,
                edit_message: true
            });
            console.log(`Score ${score} actualizado en ranking`);
        } catch (error) {
            console.error(`Error actualizando score:`, error.message);
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
    const helpText = `🎮 SHIRO COIN GAME

Comandos disponibles:
/start - Iniciar el juego
/ranking - Ver top puntuaciones
/testscore [número] - Registrar score manualmente
/help - Mostrar esta ayuda

Cómo jugar:
🟡 Recoge monedas Shiro (+2 puntos)
🔴 Evita otras monedas (-1 punto)
⏰ Tienes 90 segundos
🎯 Consigue la puntuación más alta!

Ejemplo: /testscore 25`;
    
    await bot.sendMessage(chatId, helpText);
});

bot.on('polling_error', (error) => {
  console.error(`Error de polling: ${error.code} - ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`Error del bot:`, error);
});

console.log("Bot de Telegram iniciado correctamente");
console.log(`Juego: ${GAME_SHORT_NAME}`);
console.log(`URL: ${GAME_URL}`);
console.log("Esperando comandos...");
