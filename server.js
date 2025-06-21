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
let gameMessages = new Map();

app.get("/", (req, res) => {
  res.redirect(GAME_URL);
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

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

    console.log(`Juego enviado a chat ${chatId}`);

  } catch (error) {
    console.error("Error:", error.message);
  }
});

bot.on('callback_query', async (query) => {
  if (query.game_short_name === GAME_SHORT_NAME) {
    await bot.answerCallbackQuery(query.id, { url: GAME_URL });
  }
});

bot.onText(/\/testscore (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const score = parseInt(match[1]);

    try {
        const gameInfo = gameMessages.get(chatId);

        if (!gameInfo) {
            await bot.sendMessage(chatId, "Usa /start primero");
            return;
        }

        await bot.setGameScore(userId, score, {
            chat_id: chatId,
            message_id: gameInfo.messageId,
            force: true
        });

        await bot.sendMessage(chatId, `Score ${score} registrado!`);

    } catch (error) {
        await bot.sendMessage(chatId, `Error: ${error.message}`);
    }
});

bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const gameInfo = gameMessages.get(chatId);

        if (!gameInfo) {
            await bot.sendMessage(chatId, "Usa /start primero");
            return;
        }

        const highScores = await bot.getGameHighScores(userId, {
            chat_id: chatId,
            message_id: gameInfo.messageId
        });

        let rankingText = "🏆 RANKING 🏆\n\n";

        if (highScores && highScores.length > 0) {
            highScores.sort((a, b) => b.score - a.score);

            highScores.forEach((entry, index) => {
                const name = entry.user.first_name || 'Jugador';
                rankingText += `${index + 1}. ${name}: ${entry.score}\n`;
            });
        } else {
            rankingText += "Sin puntuaciones";
        }

        await bot.sendMessage(chatId, rankingText);

    } catch (error) {
        await bot.sendMessage(chatId, "Error obteniendo ranking");
    }
});

console.log("Bot iniciado");
