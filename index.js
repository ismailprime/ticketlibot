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
  "amk",
  "aq",
  "orospu",
  "oç",
  "piç",
  "sik",
  "yarak",
  "göt",
  "fuck",
  "shit",
  "bitch",
  "idiot",
  "stupid"
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
    member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

  // ================= LINK =================

  if (LINK_REGEX.test(txt)) {

    if (isAdmin) return;

    await message.delete().catch(() => {});

    member.timeout(60 * 60 * 1000).catch(() => {});

    return message.channel.send(
      "🔗 Link yasak → 1 saat mute"
    );
  }

  // ================= SWEAR =================

  if (BAD_WORDS.some(w => txt.includes(w))) {

    if (isAdmin) return;

    await message.delete().catch(() => {});

    member.timeout(5 * 60 * 1000).catch(() => {});

    return message.channel.send(
      "⚠️ Küfür → 5 dk mute"
    );
  }

  // ================= TICKET PANEL =================

  if (message.content === "!ticketpanel") {

    if (!isAdmin) {

      return message.reply(
        "❌ Sadece adminler kullanabilir."
      );
    }

    const row = new ActionRowBuilder()
      .addComponents(
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

    if (!isAdmin) {

      return message.reply(
        "❌ Sadece adminler kullanabilir."
      );
    }

    const args = message.content.split(" ");

    const time = args[1];

    const prize =
      args.slice(2).join(" ");

    if (!time || !prize) {

      return message.reply(
        "Kullanım: !cekilis 10m Ödül"
      );
    }

    let ms = 0;

    if (time.endsWith("m")) {
      ms = parseInt(time) * 60000;
    }

    if (time.endsWith("h")) {
      ms = parseInt(time) * 3600000;
    }

    if (time.endsWith("d")) {
      ms = parseInt(time) * 86400000;
    }

    if (!ms) {

      return message.reply(
        "❌ Geçersiz süre"
      );
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("join_giveaway")
          .setLabel("🎉 Katıl")
          .setStyle(ButtonStyle.Success)
      );

    const giveawayMessage =
      await message.channel.send({
        content:
          `🎉 ÇEKİLİŞ BAŞLADI!\n\n` +
          `🎁 Ödül: ${prize}\n` +
          `⏰ Süre: ${time}`,
        components: [row]
      });

    giveaways[giveawayMessage.id] = [];

    setTimeout(() => {

      const users =
        giveaways[giveawayMessage.id];

      if (!users || users.length <= 0) {

        return message.channel.send(
          "❌ Kimse katılmadı."
        );
      }

      const winner =
        users[
          Math.floor(
            Math.random() * users.length
          )
        ];

      message.channel.send(
        `🏆 Kazanan: <@${winner}>\n🎁 Ödül: ${prize}`
      );

      delete giveaways[giveawayMessage.id];

    }, ms);
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  if (
    !interaction.isButton() &&
    !interaction.isStringSelectMenu()
  ) return;

  // ================= OPEN MENU =================

  if (interaction.customId === "ticket_open_menu") {

    const menu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticket_category")
          .setPlaceholder("📂 Kategori seç")
          .addOptions(
            {
              label: "Destek",
              value: "destek",
              emoji: "🛠️"
            },
            {
              label: "Bug",
              value: "bug",
              emoji: "🐞"
            },
            {
              label: "Şikayet",
              value: "sikayet",
              emoji: "⚠️"
            },
            {
              label: "Diğer",
              value: "diger",
              emoji: "📩"
            }
          )
      );

    return interaction.reply({
      content: "📂 Kategori seç",
      components: [menu],
      ephemeral: true
    });
  }

  // ================= CREATE TICKET =================

  if (interaction.customId === "ticket_category") {

    const category =
      interaction.values[0];

    const user =
      interaction.user;

    const channel =
      await interaction.guild.channels.create({
        name:
          `ticket-${category}-${user.username}`,

        type: 0,

        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ["ViewChannel"]
          },
          {
            id: user.id,
            allow: [
              "ViewChannel",
              "SendMessages",
              "ReadMessageHistory"
            ]
          }
        ]
      });

    await channel.send({
      content:
        `<@&1506368461964705924> <@&1506367703810707456>\n\n` +
        `🎫 Ticket Açıldı\n\n` +
        `📂 Kategori: ${category}\n` +
        `👤 Kullanıcı: <@${user.id}>\n\n` +
        `🔒 Ticketi kapatmak için aşağıdaki butonu kullan.`,

      components: [
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId("ticket_close")
              .setLabel("🔒 Ticket Kapat")
              .setStyle(ButtonStyle.Danger)
          )
      ]
    });

    return interaction.reply({
      content:
        `✅ Ticket açıldı: ${channel}`,
      ephemeral: true
    });
  }

  // ================= JOIN GIVEAWAY =================

  if (interaction.customId === "join_giveaway") {

    const users =
      giveaways[interaction.message.id];

    if (!users) {

      return interaction.reply({
        content: "❌ Çekiliş bitti.",
        ephemeral: true
      });
    }

    if (
      users.includes(interaction.user.id)
    ) {

      return interaction.reply({
        content: "❌ Zaten katıldın.",
        ephemeral: true
      });
    }

    users.push(interaction.user.id);

    return interaction.reply({
      content: "🎉 Çekilişe katıldın!",
      ephemeral: true
    });
  }

  // ================= CLOSE TICKET =================

  if (interaction.customId === "ticket_close") {

    const channel =
      interaction.channel;

    if (
      !channel.name.startsWith("ticket-")
    ) {

      return interaction.reply({
        content: "❌ Bu ticket değil",
        ephemeral: true
      });
    }

    await interaction.reply(
      "🔒 Ticket kapatılıyor..."
    );

    setTimeout(() => {

      channel.delete().catch(() => {});

    }, 2000);
  }
});

// ================= LOGIN =================

client.login(TOKEN);
