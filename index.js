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

// 🎁 DROP SYSTEM STATE
let dropActive = false;

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
    const inv = await guild.invites.fetch().catch(()=>{});
    invites.set(guild.id, inv);
  });
});

// ================= LOG SYSTEM =================

// MESAJ SİLME
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

// MESAJ EDİT
client.on("messageUpdate", async (oldM, newM) => {
  if (!oldM.guild) return;
  if (oldM.content === newM.content) return;

  const log = oldM.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!log) return;

  log.send(
    `✏️ MESAJ DÜZENLENDİ\n` +
    `👤 ${oldM.author?.tag || "Bilinmiyor"}\n\n` +
    `📌 ÖNCE: ${oldM.content || "boş"}\n` +
    `📌 SONRA: ${newM.content || "boş"}\n` +
    `⏰ ${nowTime()}`
  );
});

// ÜYE GİRİŞ
client.on("guildMemberAdd", async (member) => {

  member.roles.add(MEMBER_ROLE).catch(()=>{});

  if (member.id === OWNER_ID) {
    member.roles.add(ADMIN_ROLE_ID).catch(()=>{});
  }

  const log = member.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) {
    log.send(`📥 GİRİŞ: ${member.user.tag} | ${nowTime()}`);
  }

  const channel = member.guild.channels.cache.find(c => c.name === "💬│genel-sohbet");
  if (channel) channel.send(`👋 Hoşgeldin <@${member.id}>`);
});

// ================= MESSAGE =================

client.on("messageCreate", async (message) => {

  if (message.author.bot || !message.guild) return;

  const isAdmin =
    message.member.permissions.has(PermissionsBitField.Flags.Administrator);

  const msg = message.content.toLowerCase();

  // SELAM
  if (["sa","selam","selamün aleyküm","selamun aleyküm"].includes(msg)) {
    return message.channel.send(`Aleyküm selam <@${message.author.id}> 👋`);
  }

  // IP
  if (message.content === "!ip") {
    return message.channel.send(`mc.skyforgenw.com.tr`);
  }

  // TICKET PANEL
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

  // GIVEAWAY
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

  // ================= DROP SYSTEM =================

  if (message.content.startsWith("!drop")) {

    if (!isAdmin) return;

    if (dropActive) {
      return message.reply("❌ Zaten aktif bir drop var!");
    }

    const prize = message.content.split(" ").slice(1).join(" ");

    if (!prize) {
      return message.reply("❌ Örnek: !drop 7 günlük VIP");
    }

    dropActive = true;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("drop_claim")
        .setLabel("🎁 Ödülü Kap!")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
      content: `🎉 DROP BAŞLADI!\n🎁 Ödül: ${prize}`,
      components: [row]
    });
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // DROP CLAIM
  if (interaction.customId === "drop_claim") {

    if (!dropActive) {
      return interaction.reply({
        content: "❌ Drop bitmiş!",
        ephemeral: true
      });
    }

    dropActive = false;

    const user = interaction.user;

    await interaction.update({
      content: `🏆 Kazanan: <@${user.id}>`,
      components: []
    });

    return interaction.channel.send(
      `🎊 <@${user.id}> ödülü kazandın! Lütfen ticket aç.`
    );
  }

  // TICKET MENU
  if (interaction.customId === "ticket_open_menu") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Kategori seç")
      .addOptions(
        { label: "Destek", value: "destek" },
        { label: "Bug", value: "bug" },
        { label: "Şikayet", value: "sikayet" },
        { label: "Diğer", value: "diger" }
      );

    return interaction.reply({
      content: "Kategori seç",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  // GIVEAWAY JOIN
  if (interaction.customId === "join_giveaway") {

    const users = giveaways[interaction.message.id];

    if (!users)
      return interaction.reply({ content: "bitti", ephemeral: true });

    if (users.includes(interaction.user.id))
      return interaction.reply({ content: "zaten katıldın", ephemeral: true });

    users.push(interaction.user.id);

    return interaction.reply({ content: "katıldın", ephemeral: true });
  }

  // TICKET CREATE
  if (interaction.customId === "ticket_category") {

    const category = interaction.values[0];
    const userId = interaction.user.id;

    if (activeTickets.has(userId)) {
      return interaction.reply({
        content: "❌ Zaten ticketin var",
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${category}-${interaction.user.username}`,
      type: 0,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: ["ViewChannel"] },
        { id: userId, allow: ["ViewChannel","SendMessages","ReadMessageHistory"] }
      ]
    });

    activeTickets.set(userId, channel.id);

    await channel.send({
      content: `🎫 Ticket Açıldı\n📂 ${category}`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Kapat")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    });

    return interaction.reply({
      content: `ticket açıldı ${channel}`,
      ephemeral: true
    });
  }

  // CLOSE
  if (interaction.customId === "ticket_close") {

    const owner = [...activeTickets.entries()]
      .find(x => x[1] === interaction.channel.id);

    if (owner) activeTickets.delete(owner[0]);

    await interaction.reply("kapatılıyor...");

    setTimeout(() => {
      interaction.channel.delete().catch(()=>{});
    }, 2000);
  }
});

// ================= LOGIN =================

client.login(TOKEN);
