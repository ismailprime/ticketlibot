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
const spamMap = new Map();
const activeTickets = new Map();

// ================= BAD WORDS =================

const BAD_WORDS = [
  "amk","aq","orospu","oç","piç","sik","yarak","göt",
  "fuck","shit","bitch","idiot","stupid"
];

const LINK_REGEX =
  /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite)/i;

// ================= READY =================

client.once("ready", () => {
  console.log(`${client.user.tag} aktif!`);
});

// ================= WELCOME =================

client.on("guildMemberAdd", async (member) => {

  member.roles.add(MEMBER_ROLE).catch(()=>{});

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
      `🗑️ Silindi: ${message.author?.tag || "unknown"} → ${message.content || "boş"}`
    );
  }
});

client.on("messageUpdate", async (oldM, newM) => {

  if (!oldM.guild) return;
  if (oldM.content === newM.content) return;

  const log = oldM.guild.channels.cache.get(LOG_CHANNEL_ID);

  if (log) {
    log.send(
      `✏️ Edit: ${oldM.author?.tag || "unknown"}\n` +
      `Eski: ${oldM.content}\n` +
      `Yeni: ${newM.content}`
    );
  }
});

// ================= MESSAGE SYSTEM =================

client.on("messageCreate", async (message) => {

  if (message.author.bot || !message.guild) return;

  const txt = message.content.toLowerCase();
  const member = message.member;

  const isAdmin =
    member.permissions.has(PermissionsBitField.Flags.Administrator);

  // ================= SPAM =================

  const now = Date.now();
  const userId = message.author.id;

  if (!spamMap.has(userId)) spamMap.set(userId, []);

  const timestamps = spamMap.get(userId);
  const recent = timestamps.filter(t => now - t < 5000);

  recent.push(now);
  spamMap.set(userId, recent);

  if (recent.length >= 5) {
    member.timeout(10 * 60 * 1000).catch(()=>{});
    spamMap.set(userId, []);
    return message.channel.send("🛡️ Spam → 10 dk mute");
  }

  // ================= LINK =================

  if (LINK_REGEX.test(txt)) {
    if (!isAdmin) {
      await message.delete().catch(()=>{});
      member.timeout(60 * 60 * 1000).catch(()=>{});
      return message.channel.send("🔗 Link yasak → 1 saat mute");
    }
  }

  // ================= SWEAR =================

  if (BAD_WORDS.some(w => txt.includes(w))) {
    if (!isAdmin) {
      await message.delete().catch(()=>{});
      member.timeout(5 * 60 * 1000).catch(()=>{});
      return message.channel.send("⚠️ Küfür → 5 dk mute");
    }
  }

  // ================= TICKET PANEL =================

  if (message.content === "!ticketpanel") {

    if (!isAdmin) return message.reply("❌ Sadece adminler");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open_menu")
        .setLabel("🎫 Ticket Aç")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
      content: "🎫 Ticket sistemi",
      components: [row]
    });
  }

  // ================= GIVEAWAY =================

  if (message.content.startsWith("!cekilis")) {

    if (!isAdmin) return message.reply("❌ Sadece adminler");

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

    const msg = await message.channel.send({
      content: `🎉 ÇEKİLİŞ\n🎁 ${prize}\n⏰ ${time}`,
      components: [row]
    });

    giveaways[msg.id] = [];

    setTimeout(() => {

      const users = giveaways[msg.id];

      if (!users || users.length === 0)
        return message.channel.send("❌ kimse katılmadı");

      const winner =
        users[Math.floor(Math.random() * users.length)];

      message.channel.send(`🏆 Kazanan: <@${winner}>`);

      delete giveaways[msg.id];

    }, ms);
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  const isAdmin =
    interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

  // ================= MENU =================

  if (interaction.customId === "ticket_open_menu") {

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_category")
        .setPlaceholder("Kategori seç")
        .addOptions(
          { label: "Destek", value: "destek" },
          { label: "Bug", value: "bug" },
          { label: "Şikayet", value: "sikayet" },
          { label: "Diğer", value: "diger" }
        )
    );

    return interaction.reply({
      content: "Kategori seç",
      components: [menu],
      ephemeral: true
    });
  }

  // ================= GIVEAWAY JOIN =================

  if (interaction.customId === "join_giveaway") {

    const users = giveaways[interaction.message.id];

    if (!users)
      return interaction.reply({ content: "bitti", ephemeral: true });

    if (users.includes(interaction.user.id))
      return interaction.reply({ content: "zaten katıldın", ephemeral: true });

    users.push(interaction.user.id);

    return interaction.reply({ content: "katıldın", ephemeral: true });
  }

  // ================= TICKET LIMIT + CREATE =================

  if (interaction.customId === "ticket_category") {

    const category = interaction.values[0];
    const userId = interaction.user.id;

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
        { id: interaction.guild.id, deny: ["ViewChannel"] },
        { id: userId, allow: ["ViewChannel","SendMessages"] }
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

  // ================= CLOSE =================

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
