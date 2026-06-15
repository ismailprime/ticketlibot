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

// ================= OWNER ROLE =================

const OWNER_ID = "1003708560728920165";
const ADMIN_ROLE_ID = "1506368461964705924";

// ================= DATA =================

const giveaways = {};
const activeTickets = new Map();
const invites = new Map();
const userInvites = new Map();

// ================= READY =================

client.once("ready", async () => {
  console.log(`${client.user.tag} aktif!`);

  client.guilds.cache.forEach(async (guild) => {
    const inv = await guild.invites.fetch().catch(()=>{});
    invites.set(guild.id, inv);
  });
});

// ================= INVITE + WELCOME =================

client.on("guildMemberAdd", async (member) => {

  member.roles.add(MEMBER_ROLE).catch(()=>{});

  // 👑 SADECE SEN
  if (member.id === OWNER_ID) {
    member.roles.add(ADMIN_ROLE_ID).catch(()=>{});
  }

  // invite system
  const cached = invites.get(member.guild.id);
  const newInv = await member.guild.invites.fetch().catch(()=>{});

  const used = newInv.find(i => {
    const old = cached?.get(i.code);
    return old && i.uses > old.uses;
  });

  invites.set(member.guild.id, newInv);

  if (used?.inviter?.id) {
    const id = used.inviter.id;

    if (!userInvites.has(id)) userInvites.set(id, 0);

    userInvites.set(id, userInvites.get(id) + 1);
  }

  const channel = member.guild.channels.cache.find(
    c => c.name === "💬│genel-sohbet"
  );

  if (channel) {
    channel.send(`👋 Hoşgeldin <@${member.id}>`);
  }
});

// ================= MESSAGE =================

client.on("messageCreate", async (message) => {

  if (message.author.bot || !message.guild) return;

  const isAdmin =
    message.member.permissions.has(PermissionsBitField.Flags.Administrator);

  const msg = message.content.toLowerCase();

  // ================= SELAM SISTEM =================

  if (
    msg === "sa" ||
    msg === "selam" ||
    msg === "selamün aleyküm" ||
    msg === "selamun aleyküm"
  ) {
    return message.channel.send(
      `Aleyküm selam <@${message.author.id}>, hoşgeldin 👋 Biz de seni bekliyorduk.`
    );
  }

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

  // ================= IP =================

  if (message.content === "!ip") {

    return message.channel.send(
`**Java**
Sürüm: 1.9 - 1.21.x
Bağlantı: mc.skyforgenw.com.tr

**Bedrock**
Sürüm: Yakında
Bağlantı: mc.skyforgenw.com.tr
Port: 19132`
    );
  }

  // ================= INVITE COUNT =================

  if (message.content === "-i") {

    const count = userInvites.get(message.author.id) || 0;

    return message.channel.send(`📨 Davet sayın: **${count}**`);
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

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
      content: "📂 Kategori seç",
      components: [menu],
      ephemeral: true
    });
  }

  // ================= GIVEAWAY JOIN =================

  if (interaction.customId === "join_giveaway") {

    const users = giveaways[interaction.message.id];

    if (!users)
      return interaction.reply({ content: "❌ bitti", ephemeral: true });

    if (users.includes(interaction.user.id))
      return interaction.reply({ content: "❌ zaten katıldın", ephemeral: true });

    users.push(interaction.user.id);

    return interaction.reply({ content: "🎉 katıldın", ephemeral: true });
  }

  // ================= CREATE TICKET =================

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

  // ================= CLOSE TICKET =================

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
