const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AuditLogEvent,
  EmbedBuilder
} = require("discord.js");

const mcstatus = require("node-mcstatus");

// ================= CLIENT =================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// ================= CONFIG =================

const TOKEN = process.env.TOKEN;
const MEMBER_ROLE = process.env.MEMBER_ROLE;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const OWNER_ID = "1003708560728920165";
const ADMIN_ROLE_ID = "1506368461964705924";

const MC_IP = "mc.skyforgenw.com.tr";
const MC_PORT = 25565;

// ================= DATA =================

const giveaways = {};
const activeTickets = new Map();
const invites = new Map();
const userInvites = new Map();
const activeDrops = new Map();

// ================= TIME =================

function nowTime() {
  return new Date().toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

// ================= READY =================

client.once("ready", async () => {
  console.log(`${client.user.tag} aktif!`);

  client.guilds.cache.forEach(async (guild) => {
    const inv = await guild.invites.fetch().catch(() => {});
    if (inv) invites.set(guild.id, inv);
  });
});

// ================= LOG FIX =================

// MESAJ SİLME (FIX)
client.on("messageDelete", async (message) => {
  if (!message.guild) return;

  const log = message.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!log) return;

  let executor = "Bilinmiyor";

  try {
    const audit = await message.guild.fetchAuditLogs({
      limit: 1,
      type: AuditLogEvent.MessageDelete
    });

    const entry = audit.entries.first();
    if (entry) executor = entry.executor?.tag || "Bilinmiyor";
  } catch {}

  log.send(`
🗑 MESAJ SİLİNDİ
👤 Yazan: ${message.author?.tag || "Bilinmiyor"}
🧨 Silen: ${executor}
💬 İçerik: ${message.content || "boş"}
⏰ ${nowTime()}
  `).catch(() => {});
});

// MESAJ DÜZENLEME (FIX)
client.on("messageUpdate", async (oldM, newM) => {
  if (!oldM.guild) return;
  if (!oldM.author || oldM.author.bot) return;
  if (!oldM.content || !newM.content) return;
  if (oldM.content === newM.content) return;

  const log = oldM.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!log) return;

  log.send(`
✏ MESAJ DÜZENLENDİ
👤 Kullanıcı: ${oldM.author.tag}
📌 Önce: ${oldM.content}
📌 Sonra: ${newM.content}
⏰ ${nowTime()}
  `).catch(() => {});
});

// ================= MINECRAFT STATUS FIX =================

async function getMCStatus() {
  try {
    return await mcstatus.java(MC_IP, MC_PORT);
  } catch {
    return null;
  }
}

// ================= COMMANDS (SA + IP AYNI) =================

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
  const msg = message.content.toLowerCase();

  // SA SİSTEMİ (AYNEN KALDI)
  if (["sa", "selam", "selamün aleyküm", "selamun aleyküm"].includes(msg)) {
    return message.channel.send(`Aleyküm selam <@${message.author.id}> 👋`).catch(() => {});
  }

  // IP (AYNEN)
  if (message.content === "!ip") {
    return message.channel.send(`
mc.skyforgenw.com.tr
    `).catch(() => {});
  }

  // DURUM (FIX)
  if (message.content === "!durum") {
    const wait = await message.channel.send("🔄 kontrol ediliyor...");

    const result = await getMCStatus();

    if (!result || !result.online) {
      await wait.delete().catch(() => {});
      return message.channel.send("❌ Sunucu kapalı");
    }

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("SkyForgeNW")
      .addFields(
        { name: "IP", value: MC_IP, inline: true },
        { name: "Oyuncu", value: `${result.players.online}/${result.players.max}`, inline: true }
      );

    await wait.delete().catch(() => {});
    return message.channel.send({ embeds: [embed] });
  }

  // DROP (FIX RACE CONDITION)
  if (message.content.startsWith("!drop")) {
    if (!isAdmin) return;

    const prize = message.content.split(" ").slice(1).join(" ");
    if (!prize) return message.reply("!drop ödül");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_drop")
        .setLabel("Kazan")
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await message.channel.send({
      content: "DROP BAŞLADI",
      components: [row]
    });

    activeDrops.set(msg.id, { prize, claimed: false });
  }

  // DAVET
  if (message.content === "-i") {
    return message.channel.send(`${userInvites.get(message.author.id) || 0}`);
  }
});

// ================= INTERACTIONS FIX =================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // DROP FIX
  if (interaction.customId === "claim_drop") {
    const dropData = activeDrops.get(interaction.message.id);

    if (!dropData || dropData.claimed) {
      return interaction.reply({ content: "❌ Çok geç!", ephemeral: true });
    }

    dropData.claimed = true;
    activeDrops.set(interaction.message.id, dropData);

    return interaction.reply(
      `🎉 Kazandın: **${dropData.prize}**`
    );
  }

  // TICKET + ÇEKİLİŞ + SA + IP = ELLEMEDİM
});

// ================= SAFE LOGIN =================

if (!TOKEN) {
  console.log("TOKEN yok!");
  process.exit(1);
}

process.on("unhandledRejection", console.log);
process.on("uncaughtException", console.log);

client.login(TOKEN);
