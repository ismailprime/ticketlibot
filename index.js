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

  const ch = member.guild.channels.cache.find(
    c => c.name === "💬│genel-sohbet"
  );

  if (ch) ch.send(`👋 Hoşgeldin <@${member.id}>`);

  const log = member.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) log.send(`📥 Yeni üye: <@${member.id}>`);
});

// ================= LOG =================

client.on("messageDelete", async (m) => {
  if (!m.guild) return;

  const log = m.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) log.send(`🗑️ Silindi: ${m.author?.tag} → ${m.content || "boş"}`);
});

client.on("messageUpdate", async (o, n) => {
  if (!o.guild || o.content === n.content) return;

  const log = o.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) {
    log.send(
      `✏️ Edit: ${o.author?.tag}\nEski: ${o.content}\nYeni: ${n.content}`
    );
  }
});

// ================= MESSAGE =================

client.on("messageCreate", async (message) => {

  if (message.author.bot || !message.guild) return;

  const txt = message.content.toLowerCase();
  const member = message.member;

  const isAdmin =
    member.permissions.has(PermissionsBitField.Flags.Administrator);

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

  // ================= PANEL =================

  if (message.content === "!ticketpanel") {

    if (!isAdmin)
      return message.reply("❌ Sadece admin");

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

    if (!isAdmin)
      return message.reply("❌ Sadece admin");

    const args = message.content.split(" ");
    const time = args[1];
    const prize = args.slice(2).join(" ");

    let ms = 0;

    if (time.endsWith("m")) ms = parseInt(time) * 60000;
    if (time.endsWith("h")) ms = parseInt(time) * 3600000;
    if (time.endsWith("d")) ms = parseInt(time) * 86400000;

    if (!ms)
      return message.reply("❌ süre hatalı");

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
    interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

  // ================= PANEL =================

  if (interaction.customId === "ticket_open_menu") {

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_category")
        .setPlaceholder("Kategori seç")
        .addOptions(
          { label: "Destek", value: "destek" },
          { label: "Bug", value: "bug" },
          { label: "Şikayet", value: "sikayet" },
          { label: "Diğer", value: "diger" },
          { label: "Ödeme / Muhasebe", value: "muhasebe", emoji: "💰" }
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

    const list = giveaways[interaction.message.id];

    if (!list)
      return interaction.reply({ content: "bitti", ephemeral: true });

    if (list.includes(interaction.user.id))
      return interaction.reply({ content: "zaten katıldın", ephemeral: true });

    list.push(interaction.user.id);

    return interaction.reply({ content: "katıldın", ephemeral: true });
  }

  // ================= TICKET CREATE =================

  if (interaction.customId === "ticket_category") {

    const category = interaction.values[0];
    const user = interaction.user;

    let perms = [
      {
        id: interaction.guild.id,
        deny: ["ViewChannel"]
      },
      {
        id: user.id,
        allow: ["ViewChannel","SendMessages","ReadMessageHistory"]
      }
    ];

    // SUPPORT ROLLER (NORMAL TICKET)
    if (category !== "muhasebe") {

      perms.push(
        {
          id: "1506368461964705924",
          allow: ["ViewChannel","SendMessages","ReadMessageHistory"]
        },
        {
          id: "1506367703810707456",
          allow: ["ViewChannel","SendMessages","ReadMessageHistory"]
        }
      );
    }

    // MUHASEBE SADECE 2 KİŞİ
    if (category === "muhasebe") {

      perms.push(
        {
          id: "1221109335409688647",
          allow: ["ViewChannel","SendMessages","ReadMessageHistory"]
        },
        {
          id: "701120598922756177",
          allow: ["ViewChannel","SendMessages","ReadMessageHistory"]
        }
      );
    }

    const ch = await interaction.guild.channels.create({
      name: `ticket-${category}-${user.username}`,
      type: 0,
      permissionOverwrites: perms
    });

    await ch.send({
      content:
        category === "muhasebe"
          ? `<@1221109335409688647> <@701120598922756177>`
          : `<@&1506368461964705924> <@&1506367703810707456>`,

      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("🔒 Kapat")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    });

    return interaction.reply({
      content: `ticket açıldı ${ch}`,
      ephemeral: true
    });
  }

  // ================= CLOSE =================

  if (interaction.customId === "ticket_close") {

    await interaction.reply("kapatılıyor...");

    setTimeout(() => {
      interaction.channel.delete().catch(()=>{});
    }, 2000);
  }
});

// ================= LOGIN =================

client.login(TOKEN);
