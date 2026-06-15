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

// ================= DATA =================

const giveaways = {};
const activeTickets = new Map();

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
});

// ================= MESSAGE COMMANDS =================

client.on("messageCreate", async (message) => {

  if (message.author.bot || !message.guild) return;

  const isAdmin =
    message.member.permissions.has(PermissionsBitField.Flags.Administrator);

  // ================= TICKET PANEL =================

  if (message.content === "!ticketpanel") {

    if (!isAdmin) return message.reply("❌ Sadece admin");

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

    if (!isAdmin) return message.reply("❌ Sadece admin");

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

  // ================= IP COMMAND =================

  if (message.content === "!ip") {

    return message.channel.send(
`**Java**
Sürüm: 1.9 - 1.21.x
Bağlantı Adresi: mc.skyforgenw.com.tr

**Bedrock**
Sürüm: Yakında
Bağlantı Adresi: mc.skyforgenw.com.tr
Port: 19132`
    );
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  const isAdmin =
    interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

  // ================= TICKET MENU =================

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
      content: "📂 Kategori seç",
      components: [menu],
      ephemeral: true
    });
  }

  // ================= GIVEAWAY JOIN =================

  if (interaction.customId === "join_giveaway") {

    const users = giveaways[interaction.message.id];

    if (!users)
      return interaction.reply({ content: "❌ Çekiliş bitti", ephemeral: true });

    if (users.includes(interaction.user.id))
      return interaction.reply({ content: "❌ Zaten katıldın", ephemeral: true });

    users.push(interaction.user.id);

    return interaction.reply({ content: "🎉 Katıldın", ephemeral: true });
  }

  // ================= CREATE TICKET =================

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
            .setLabel("🔒 Kapat")
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

    if (owner) activeTickets.delete(owner[0]);

    await interaction.reply("🔒 Kapatılıyor...");

    setTimeout(() => {
      interaction.channel.delete().catch(()=>{});
    }, 2000);
  }
});

// ================= LOGIN =================

client.login(TOKEN);
