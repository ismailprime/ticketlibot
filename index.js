const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

// ================= CLIENT =================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember
  ]
});

// ================= CONFIG =================

const TOKEN = process.env.TOKEN;
const MEMBER_ROLE = process.env.MEMBER_ROLE;

const OWNER_ID = "1003708560728920165";
const ADMIN_ROLE_ID = "1506368461964705924";

const LOG_CHANNEL_ID = "1512629605830496257";

// ================= DATA =================

const giveaways = {};
const activeTickets = new Map();
const invites = new Map();
const userInvites = new Map();

// INVITE FIX CACHE
const guildInvitesCache = new Map();

// DROP SYSTEM
let dropActive = false;

// ================= TIME =================

function nowTime() {
  return new Date().toLocaleString("tr-TR");
}

// ================= READY =================

client.once("ready", async () => {
  console.log(`${client.user.tag} aktif!`);

  client.guilds.cache.forEach(async (guild) => {
    const inv = await guild.invites.fetch().catch(() => {});
    guildInvitesCache.set(guild.id, inv);
  });

  setInterval(async () => {
    client.guilds.cache.forEach(async (guild) => {
      const inv = await guild.invites.fetch().catch(() => {});
      guildInvitesCache.set(guild.id, inv);
    });
  }, 30000);
});

// ================= LOG SYSTEM =================

client.on("messageDelete", async (message) => {
  if (!message.guild) return;

  const log = message.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!log) return;

  let executor = "Bilinmiyor";

  try {
    const audit = await message.guild.fetchAuditLogs({ limit: 1, type: 72 });
    const entry = audit.entries.first();
    if (entry) executor = entry.executor.tag;
  } catch {}

  log.send(
    `🗑️ MESAJ SİLİNDİ\n` +
    `👤 Yazan: ${message.author?.tag || "Bilinmiyor"}\n` +
    `🧨 Silen: ${executor}\n` +
    `💬 İçerik: ${message.content || "boş"}\n` +
    `⏰ ${nowTime()}`
  );
});

client.on("messageUpdate", async (oldM, newM) => {
  if (!oldM.guild) return;
  if (oldM.content === newM.content) return;

  const log = oldM.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!log) return;

  log.send(
    `✏️ MESAJ DÜZENLENDİ\n` +
    `👤 ${oldM.author?.tag || "Bilinmiyor"}\n` +
    `📌 ÖNCE: ${oldM.content}\n` +
    `📌 SONRA: ${newM.content}\n` +
    `⏰ ${nowTime()}`
  );
});

// ================= INVITE FIX =================

client.on("guildMemberAdd", async (member) => {

  member.roles.add(MEMBER_ROLE).catch(() => {});

  // INVITE TRACKING
  try {
    const newInvites = await member.guild.invites.fetch();
    const oldInvites = guildInvitesCache.get(member.guild.id);

    const usedInvite = newInvites.find(i =>
      (oldInvites?.get(i.code)?.uses || 0) < i.uses
    );

    guildInvitesCache.set(member.guild.id, newInvites);

    if (usedInvite && usedInvite.inviter) {
      const id = usedInvite.inviter.id;
      const current = userInvites.get(id) || 0;
      userInvites.set(id, current + 1);
    }
  } catch {}

  const log = member.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) log.send(`📥 GİRİŞ: ${member.user.tag} | ${nowTime()}`);

  const channel = member.guild.channels.cache.find(c => c.name === "💬│genel-sohbet");
  if (channel) channel.send(`👋 Hoşgeldin <@${member.id}>`);
});

// ================= MESSAGE =================

client.on("messageCreate", async (message) => {

  if (message.author.bot || !message.guild) return;

  const isAdmin =
    message.member.permissions.has(PermissionsBitField.Flags.Administrator);

  const msg = message.content.toLowerCase();

  if (["sa","selam","selamün aleyküm"].includes(msg)) {
    return message.channel.send(`Aleyküm selam <@${message.author.id}> 👋`);
  }

  if (message.content === "!ip") {
    return message.channel.send(`mc.skyforgenw.com.tr`);
  }

  if (message.content === "-i") {
    const count = userInvites.get(message.author.id) || 0;
    return message.channel.send(`📨 Davet sayın: **${count}**`);
  }

  // ================= TICKET =================

  if (message.content === "!ticketpanel") {
    if (!isAdmin) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open_menu")
        .setLabel("🎫 Ticket Aç")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
      content: "🎫 Ticket sistemi aktif",
      components: [row]
    });
  }

  // ================= GIVEAWAY =================

  if (message.content.startsWith("!cekilis")) {

    if (!isAdmin) return;

    const args = message.content.split(" ");
    const time = args[1];
    const prize = args.slice(2).join(" ");

    let ms = 0;
    if (time.endsWith("m")) ms = parseInt(time) * 60000;
    if (time.endsWith("h")) ms = parseInt(time) * 3600000;
    if (time.endsWith("d")) ms = parseInt(time) * 86400000;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("join_giveaway")
        .setLabel("🎉 Katıl")
        .setStyle(ButtonStyle.Success)
    );

    const msgGiveaway = await message.channel.send({
      content: `🎉 ÇEKİLİŞ\n🎁 ${prize}\n⏰ ${time}`,
      components: [row]
    });

    giveaways[msgGiveaway.id] = [];

    setTimeout(() => {

      const users = giveaways[msgGiveaway.id];

      if (!users || users.length === 0)
        return message.channel.send("❌ kimse katılmadı");

      const winner =
        users[Math.floor(Math.random() * users.length)];

      message.channel.send(`🏆 Kazanan: <@${winner}>`);

      delete giveaways[msgGiveaway.id];

    }, ms);
  }

  // ================= DROP =================

  if (message.content.startsWith("!drop")) {

    if (!isAdmin) return;

    if (dropActive) return message.reply("❌ Zaten drop var!");

    const prize = message.content.split(" ").slice(1).join(" ");
    if (!prize) return message.reply("Ödül yaz!");

    dropActive = true;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("drop_claim")
        .setLabel("🎁 Ödülü Kap!")
        .setStyle(ButtonStyle.Success)
    );

    message.channel.send({
      content: `🎉 DROP\n🎁 ${prize}`,
      components: [row]
    });
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  if (interaction.customId === "drop_claim") {

    if (!dropActive)
      return interaction.reply({ content: "Bitti", ephemeral: true });

    dropActive = false;

    const user = interaction.user;

    await interaction.update({
      content: `🏆 Kazanan: <@${user.id}>`,
      components: []
    });

    return interaction.channel.send(
      `🎊 <@${user.id}> kazandın! Ticket aç.`
    );
  }

  if (interaction.customId === "ticket_open_menu") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Kategori seç")
      .addOptions(
        { label: "Destek", value: "destek" },
        { label: "Bug", value: "bug" }
      );

    return interaction.reply({
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  if (interaction.customId === "join_giveaway") {

    const users = giveaways[interaction.message.id];

    if (!users)
      return interaction.reply({ content: "bitti", ephemeral: true });

    if (users.includes(interaction.user.id))
      return interaction.reply({ content: "zaten katıldın", ephemeral: true });

    users.push(interaction.user.id);

    return interaction.reply({ content: "katıldın", ephemeral: true });
  }

});

// ================= LOGIN =================

client.login(TOKEN);
