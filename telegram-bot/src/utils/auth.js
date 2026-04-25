function getAdminChatIds() {
  return (process.env.TELEGRAM_ADMIN_CHAT_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

function getChatId(ctx) {
  return ctx.chat?.id?.toString() || ctx.message?.chat?.id?.toString() || '';
}

function isAdminChat(ctx) {
  const chatId = getChatId(ctx);
  return chatId ? getAdminChatIds().includes(chatId) : false;
}

function requireAdmin(handler) {
  return async function adminOnlyHandler(ctx) {
    if (!isAdminChat(ctx)) {
      return ctx.reply('Bu komutu kullanma yetkin yok ❌');
    }

    return handler(ctx);
  };
}

module.exports = {
  getAdminChatIds,
  getChatId,
  isAdminChat,
  requireAdmin,
};
