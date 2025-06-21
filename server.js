const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const GAME_SHORT_NAME = 'ShiroCoinDash';
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app";

if (!BOT_TOKEN) {
    console.error("ERROR: Token no configurado.");
    process.exit(1);
}

app.use(express.json());
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ✅ CRÍTICO: Almacenar messageId correctamente
let gameMessages = new Map(); // chatId -> {messageId, userId}

app.get("/", (req, res) => {
  res.redirect(GAME_URL);
});

// ✅ COMANDO /start CORREGIDO
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  console.log(`/start: Chat ${chatId}, Usuario ${userId}`);

  const keyboard = {
    inline_keyboard: [[{ text: '🎮 Jugar Shiro Coin', callback_game: {}}]]
  };

  try {
    const sentMessage = await bot.sendGame(chatId, GAME_SHORT_NAME, { 
      reply_markup: keyboard 
    });
    
    // ✅ GUARDAR DATOS COMPLETOS
    gameMessages.set(chatId, {
      messageId: sentMessage.message_id,
      userId: userId
    });
    
    console.log(`✅ Juego enviado - Chat: ${chatId}, MessageID: ${sentMessage.message_id}`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    bot.sendMessage(chatId, "Error al iniciar juego");
  }
});

// ✅ CALLBACK QUERY 
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  if (query.game_short_name === GAME_SHORT_NAME) {
    console.log(`✅ Abriendo juego para usuario ${userId}`);
    await bot.answerCallbackQuery(query.id, { url: GAME_URL });
  }
});

// ✅ COMANDO /ranking CON FORCE REGISTRATION
bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const gameInfo = gameMessages.get(chatId);
        
        if (!gameInfo) {
            await bot.sendMessage(chatId, "❌ Usa /start primero");
            return;
        }

        // ✅ PRIMERO REGISTRAR UN SCORE DE PRUEBA (CRÍTICO)
        console.log(`🎯 Registrando score de prueba para activar ranking...`);
        try {
            await bot.setGameScore(userId, 1, {
                chat_id: chatId,
                message_id: gameInfo.messageId,
                force: true
            });
            console.log(`✅ Score de prueba registrado`);
        } catch (err) {
            console.log(`⚠️ Error score prueba:`, err.message);
        }

        // ✅ AHORA OBTENER RANKING
        const highScores = await bot.getGameHighScores(userId, {
            chat_id: chatId,
            message_id: gameInfo.messageId
        });
        
        console.log(`📊 Ranking obtenido:`, highScores);
        
        let rankingText = "🏆 **RANKING SHIRO COIN** 🏆\n\n";
        
        if (highScores && highScores.length > 0) {
            const sortedScores = highScores.sort((a, b) => b.score - a.score);
            
            sortedScores.forEach((entry, index) => {
                const name = entry.user.first_name || 'Jugador';
                let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                rankingText += `${medal} ${name}: **${entry.score}** pts\n`;
            });
        } else {
            rankingText += "📭 Sin puntuaciones. ¡Juega primero!";
        }
        
        await bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error("❌ Error ranking:", error);
        await bot.sendMessage(chatId, "❌ Error obteniendo ranking");
    }
});

// ✅ DETECTAR SCORES AUTOMÁTICOS DEL JUEGO
bot.on('message', async (msg) => {
    if (msg.game_score !== undefined) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const score = msg.game_score;
        
        console.log(`🎯 SCORE DETECTADO: Usuario ${userId}, Score: ${score}`);
        
        // Actualizar messageId si es necesario
        const gameInfo = gameMessages.get(chatId) || {};
        gameInfo.messageId = msg.message_id;
        gameMessages.set(chatId, gameInfo);
    }
});

bot.on('polling_error', (error) => {
  console.error(`❌ Polling error: ${error.message}`);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor en puerto ${PORT}`);
});

console.log("🤖 Bot iniciado");
