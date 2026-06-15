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
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const MEMBER_ROLE = process.env.MEMBER_ROLE;

// ================= DATA =================

const giveaways = {};

// 🔥 EKLENDİ
const spamMap = new Map();
const activeTickets = new Map();

// ================= BAD WORDS =================

const BAD_WORDS = [
  "amk","aq","orospu","oç","piç","sik","yarak","göt",
  "fuck","shit","bitch","idiot","stupid"
];

// ================= LINK =================

const LINK_REGEX =
  /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite)/i;

// ================= READY =================

client.once("ready", () => {
  console.log(`${client.user.tag} aktif!`);
});

// ================= WELCOME =================

client.on("guildMemberAdd", async (member) => {

  member.roles.add(MEMBER_ROLE).catch(() => {});

  const channel = member.guild.channels.cache.find(
    c => c.name === "💬│genel-sohbet"
  );

  if (channel) {
    channel.send(`👋 Hoşgeldin <@${member.id}>`);
  }

  const log = member.guild.channels.cache.get(LOG_CHANNEL_ID);

  if (log) {
    log.send(`📥 Yeni üye: <@${member.id}>`);
  }
});

// ================= LOG SYSTEM =================

client.on("messageDelete", async (message) => {

  if (!message.guild) return;

  const log = message.guild.channels.cache.get(LOG_CHANNEL_ID);

  if (log) {
    log.send(
      `🗑️ Silindi: ${message.author?.tag} → ${message.content || "boş"}`
    );
  }
});

client.on("messageUpdate", async (oldM, newM) => {

  if (!oldM.guild) return;

  if (oldM.content === newM.content) return;

  const log = oldM.guild.channels.cache.get(LOG_CHANNEL_ID);

  if (log) {
    log.send(
      `✏️ Edit: ${oldM.author?.tag}\n` +
      `Eski: ${oldM.content}\n` +
      `Yeni: ${newM.content}`
    );
  }
});

// ================= MESSAGE SYSTEM =================

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (!message.guild) return;

  const txt = message.content.toLowerCase();
  const member = message.member;

  const isAdmin =
    member.permissions.has(PermissionsBitField.Flags.Administrator);

  // ================= 🛡️ SPAM (EKLENDİ) =================

  const now = Date.now();
  const userId = message.author.id;

  if (!spamMap.has(userId)) {
    spamMap.set(userId, []);
  }

  const timestamps = spamMap.get(userId);

  const recent = timestamps.filter(t => now - t < 5000);
  recent.push(now);

  spamMap.set(userId, recent);

  if (recent.length >= 5) {

    member.timeout(10 * 60 * 1000).catch(() => {});
    spamMap.set(userId, []);

    return message.channel.send("🛡️ Spam → 10 dk mute");
  }

  // ================= LINK =================

  if (LINK_REGEX.test(txt)) {

    if (isAdmin) return;

    await message.delete().catch(() => {});
    member.timeout(60 * 60 * 1000).catch(() => {});

    return message.channel.send("🔗 Link yasak → 1 saat mute");
  }

  // ================= SWEAR =================

  if (BAD_WORDS.some(w => txt.includes(w))) {

    if (isAdmin) return;

    await message.delete().catch(() => {});
    member.timeout(5 * 60 * 1000).catch(() => {});

    return message.channel.send("⚠️ Küfür → 5 dk mute");
  }

  // ================= TICKET PANEL =================

  if (message.content === "!ticketpanel") {

    if (!isAdmin) return message.reply("❌ Sadece adminler kullanabilir.");

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

});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  const isAdmin =
    interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

  // ================= OPEN MENU =================

  if (interaction.customId === "ticket_open_menu") {

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_category")
        .setPlaceholder("📂 Kategori seç")
        .addOptions(
          { label: "Destek", value: "destek", emoji: "🛠️" },
          { label: "Bug", value: "bug", emoji: "🐞" },
          { label: "Şikayet", value: "sikayet", emoji: "⚠️" },
          { label: "Diğer", value: "diger", emoji: "📩" }
        )
    );

    return interaction.reply({
      content: "📂 Kategori seç",
      components: [menu],
      ephemeral: true
    });
  }

  // ================= GIVEAWAY =================

  if (interaction.customId === "join_giveaway") {

    const users = giveaways[interaction.message.id];

    if (!users) {
      return interaction.reply({ content: "❌ Çekiliş bitti.", ephemeral: true });
    }

    if (users.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Zaten katıldın.", ephemeral: true });
    }

    users.push(interaction.user.id);

    return interaction.reply({ content: "🎉 Çekilişe katıldın!", ephemeral: true });
  }

  // ================= 🎫 TICKET CREATE (LIMIT EKLİ) =================

  if (interaction.customId === "ticket_category") {

    const category = interaction.values[0];
    const userId = interaction.user.id;

    // 🔥 1 TICKET LIMIT
    if (activeTickets.has(userId)) {
      return interaction.reply({
        content: "❌ Zaten açık ticketin var!",
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${category}-${interaction.user.username}`,
      type: 0,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: ["ViewChannel"]
        },
        {
          id: userId,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
        }
      ]
    });

    // kayıt
    activeTickets.set(userId, channel.id);

    await channel.send({
      content:
        `<@&1506368461964705924> <@&1506367703810707456>\n\n` +
        `🎫 Ticket Açıldı\n📂 ${category}`,

      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("🔒 Ticket Kapat")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    });

    return interaction.reply({
      content: `✅ Ticket açıldı: ${channel}`,
      ephemeral: true
    });
  }

  // ================= CLOSE TICKET =================

  if (interaction.customId === "ticket_close") {

    const owner = [...activeTickets.entries()]
      .find(x => x[1] === interaction.channel.id);

    if (owner) {
      activeTickets.delete(owner[0]);
    }

    await interaction.reply("🔒 Ticket kapatılıyor...");

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  }
});

// ================= LOGIN =================

client.login(TOKEN);
