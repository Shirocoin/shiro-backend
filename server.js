const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CONFIGURACIÓN CORRECTA
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const GAME_SHORT_NAME = 'ShiroCoinDash';
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app";

if (!BOT_TOKEN) {
    console.error("ERROR: Token de Telegram Bot no configurado.");
    process.exit(1);
}

// ✅ MIDDLEWARE PARA RECIBIR DATOS DEL JUEGO
app.use(express.json());

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ✅ ALMACENAR INFORMACIÓN DE JUEGOS
let gameMessages = new Map(); // chatId -> {messageId, userId}

app.get("/", (req, res) => {
  console.log("Redirigiendo al juego...");
  res.redirect(GAME_URL);
});

// ✅ ENDPOINT PARA RECIBIR SCORES DEL JUEGO
app.post("/game-score", async (req, res) => {
  try {
    const { userId, chatId, score } = req.body;
    console.log(`📡 Score recibido via HTTP: Usuario ${userId}, Score: ${score}, Chat: ${chatId}`);
    
    const gameInfo = gameMessages.get(parseInt(chatId));
    if (gameInfo && gameInfo.messageId) {
      await bot.setGameScore(parseInt(userId), score, {
        chat_id: parseInt(chatId),
        message_id: gameInfo.messageId,
        force: true, // ✅ CRÍTICO: Permite scores menores
        edit_message: true
      });
      console.log(`✅ Score ${score} registrado oficialmente`);
      res.json({success: true});
    } else {
      console.error(`❌ No se encontró gameInfo para chat: ${chatId}`);
      res.status(404).json({error: 'Game not found'});
    }
  } catch (error) {
    console.error('❌ Error registrando score:', error);
    res.status(500).json({error: error.message});
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});

// ✅ COMANDO /start MEJORADO
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
    
    // ✅ GUARDAR INFORMACIÓN COMPLETA DEL JUEGO
    gameMessages.set(chatId, {
      messageId: sentMessage.message_id,
      userId: userId
    });
    
    console.log(`✅ Juego enviado. Chat: ${chatId}, MessageID: ${sentMessage.message_id}, Usuario: ${userId}`);
    
  } catch (error) {
    console.error("❌ Error enviando juego:", error.message);
    bot.sendMessage(chatId, "Error al iniciar el juego. Verifica la configuración del bot.");
  }
});

// ✅ CALLBACK QUERY MEJORADO
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  
  console.log(`Callback query de ${query.from.first_name || 'Usuario'} (ID: ${userId})`);

  if (query.game_short_name === GAME_SHORT_NAME) {
    // ✅ ACTUALIZAR INFO DEL USUARIO QUE JUEGA
    const gameInfo = gameMessages.get(chatId);
    if (gameInfo) {
      gameInfo.currentUserId = userId;
      gameMessages.set(chatId, gameInfo);
    }
    
    console.log(`✅ Abriendo juego para usuario ${userId}: ${GAME_URL}`);
    await bot.answerCallbackQuery(query.id, { url: GAME_URL });
  } else {
    await bot.answerCallbackQuery(query.id, { text: "Juego no disponible." });
  }
});

// ✅ COMANDO /ranking COMPLETAMENTE CORREGIDO
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
        
        // ✅ LLAMADA CORRECTA A getGameHighScores
        const highScores = await bot.getGameHighScores(userId, {
            chat_id: chatId,
            message_id: gameInfo.messageId
        });
        
        console.log(`Respuesta de Telegram:`, highScores);
        
        let rankingText = "🏆 **RANKING SHIRO COIN** 🏆\n\n";
        
        if (highScores && highScores.length > 0) {
            // Ordenar por puntuación descendente
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

// ✅ LISTENER PARA MENSAJES DE JUEGO
bot.on('message', async (msg) => {
    // ✅ DETECTAR WEB APP DATA (para Mini Apps)
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
                        force: true, // ✅ CRÍTICO
                        edit_message: true
                    });
                    console.log(`✅ Score ${score} registrado via Mini App`);
                }
            }
        } catch (error) {
            console.error('❌ Error parseando datos de Mini App:', error);
        }
    }
    
    // ✅ DETECTAR ACTUALIZACIONES DE SCORE DEL JUEGO
    if (msg.game_score !== undefined) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = msg.from.first_name || 'Jugador';
        const score = msg.game_score;
        
        console.log(`🎯 Nueva puntuación registrada:`);
        console.log(`   Chat: ${chatId}`);
        console.log(`   Usuario: ${userName} (${userId})`);
        console.log(`   Puntuación: ${score}`);
        
        // Actualizar el mapping si es necesario
        if (msg.message_id) {
            const existing = gameMessages.get(chatId) || {};
            gameMessages.set(chatId, {
                ...existing,
                messageId: msg.message_id
            });
        }
    }
});

// ✅ COMANDO DE AYUDA
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
🎮 **SHIRO COIN GAME**

**Comandos disponibles:**
/start - Iniciar el juego
/ranking - Ver top puntuaciones
/help - Mostrar esta ayuda

**Cómo jugar:**
🟡 Recoge monedas Shiro (+2 puntos)
🔴 Evita otras monedas (-1 punto)
⏰ Tienes 15 segundos
🎯 ¡Consigue la puntuación más alta!
    `;
    
    await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// ✅ MANEJO DE ERRORES
bot.on('polling_error', (error) => {
  console.error(`❌ Error de polling: ${error.code} - ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`❌ Error del bot:`, error);
});

console.log("🤖 Bot de Telegram iniciado correctamente");
console.log(`🎮 Juego: ${GAME_SHORT_NAME}`);
console.log(`🌐 URL: ${GAME_URL}`);
console.log("⏳ Esperando comandos...");
