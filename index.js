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

// ================= SAFE LOG =================

// MESSAGE DELETE
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

// MESSAGE UPDATE
client.on("messageUpdate", async (oldM, newM) => {
  if (!oldM.guild) return;
  if (!oldM.author || oldM.author.bot) return;
  if (oldM.content === newM.content) return;

  const log = oldM.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!log) return;

  log.send(`
✏ MESAJ DÜZENLENDİ
👤 Kullanıcı: ${oldM.author.tag}
📌 Önce: ${oldM.content || "boş"}
📌 Sonra: ${newM.content || "boş"}
⏰ ${nowTime()}
  `).catch(() => {});
});

// ================= JOIN + INVITE =================

client.on("guildMemberAdd", async (member) => {
  member.roles.add(MEMBER_ROLE).catch(() => {});
  if (member.id === OWNER_ID) member.roles.add(ADMIN_ROLE_ID).catch(() => {});

  const log = member.guild.channels.cache.get(LOG_CHANNEL_ID);

  let inviterText = "Bilinmiyor";

  try {
    const oldInvites = invites.get(member.guild.id);
    const newInvites = await member.guild.invites.fetch().catch(() => {});

    if (oldInvites && newInvites) {
      const used = newInvites.find(inv => {
        const old = oldInvites.get(inv.code);
        return old && inv.uses > old.uses;
      });

      if (used?.inviter) {
        const id = used.inviter.id;
        const count = userInvites.get(id) || 0;
        userInvites.set(id, count + 1);
        inviterText = `${used.inviter.tag} (${count + 1})`;
      }

      invites.set(member.guild.id, newInvites);
    }
  } catch {}

  log?.send(`📥 ${member.user.tag} | Davet: ${inviterText}`).catch(() => {});

  const ch = member.guild.channels.cache.find(c => c.name === "💬│genel-sohbet");
  ch?.send(`👋 Hoşgeldin <@${member.id}>`).catch(() => {});
});

// ================= COMMANDS =================

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
  const msg = message.content.toLowerCase();

  // selam
  if (["sa", "selam", "selamün aleyküm"].includes(msg)) {
    return message.reply(`Aleyküm selam 👋`);
  }

  // ip
  if (message.content === "!ip") {
    return message.channel.send(`mc.skyforgenw.com.tr`);
  }

  // durum
  if (message.content === "!durum") {
    const wait = await message.channel.send("🔄 kontrol ediliyor...");

    try {
      const result = await mcstatus.java(MC_IP, MC_PORT);

      if (!result?.online) throw new Error();

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("SkyForgeNW")
        .addFields(
          { name: "IP", value: MC_IP, inline: true },
          { name: "Oyuncu", value: `${result.players.online}/${result.players.max}`, inline: true }
        );

      await wait.delete().catch(() => {});
      return message.channel.send({ embeds: [embed] });

    } catch {
      await wait.delete().catch(() => {});
      return message.channel.send("❌ Sunucu kapalı");
    }
  }

  // DROP
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

  // davet
  if (message.content === "-i") {
    return message.channel.send(`${userInvites.get(message.author.id) || 0}`);
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  // DROP CLAIM
  if (i.customId === "claim_drop") {
    const data = activeDrops.get(i.message.id);

    if (!data || data.claimed)
      return i.reply({ content: "kaçtı", ephemeral: true });

    data.claimed = true;

    return i.reply(`kazandın: ${data.prize}`);
  }
});

// ================= LOGIN =================

if (!TOKEN) {
  console.log("TOKEN yok!");
  process.exit(1);
}

process.on("unhandledRejection", console.log);
process.on("uncaughtException", console.log);

client.login(TOKEN);
