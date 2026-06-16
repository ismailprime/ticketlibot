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

// 🔥 INVITE FIX
const invites = new Map();
const userInvites = new Map();

// 🎁 DROP SYSTEM
let dropActive = false;
let dropClaimed = false;

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
    invites.set(guild.id, inv);
  });
});

// ================= INVITE FIX =================

client.on("guildMemberAdd", async (member) => {
  member.roles.add(MEMBER_ROLE).catch(() => {});

  const log = member.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) log.send(`📥 GİRİŞ: ${member.user.tag}`);

  const channel = member.guild.channels.cache.find(c => c.name === "💬│genel-sohbet");
  if (channel) channel.send(`👋 Hoşgeldin <@${member.id}>`);

  // invite update (basit fix)
  const cachedInvites = invites.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch().catch(() => {});
  invites.set(member.guild.id, newInvites);

  for (const inv of newInvites.values()) {
    const old = cachedInvites?.find(i => i.code === inv.code);
    if (old && old.uses < inv.uses) {
      const count = userInvites.get(inv.inviter?.id) || 0;
      userInvites.set(inv.inviter?.id, count + 1);
    }
  }
});

// ================= MESSAGE =================

client.on("messageCreate", async (message) => {

  if (!message.guild || message.author.bot) return;

  const isAdmin =
    message.member.permissions.has(PermissionsBitField.Flags.Administrator);

  const msg = message.content.toLowerCase();

  // ================= SELAM =================
  if (["sa","selam","selamün aleyküm","selamun aleyküm"].includes(msg)) {
    return message.channel.send(`Aleyküm selam <@${message.author.id}> 👋`);
  }

  // ================= IP =================
  if (message.content === "!ip") {
    return message.channel.send(`mc.skyforgenw.com.tr`);
  }

  // ================= -i FIX =================
  if (message.content === "-i") {
    const count = userInvites.get(message.author.id) || 0;
    return message.channel.send(`📨 Davet sayın: **${count}**`);
  }

  // ================= DROP =================
  if (message.content.startsWith("!drop")) {

    if (!isAdmin) return;

    if (dropActive) {
      return message.reply("❌ Zaten drop aktif!");
    }

    const prize = message.content.split(" ").slice(1).join(" ");
    if (!prize) return message.reply("❌ !drop 7 günlük VIP");

    dropActive = true;
    dropClaimed = false;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("drop_claim")
        .setLabel("🎁 Kap!")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
      content: `🎉 DROP BAŞLADI!\n🎁 Ödül: ${prize}`,
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
    if (time?.endsWith("m")) ms = parseInt(time) * 60000;
    if (time?.endsWith("h")) ms = parseInt(time) * 3600000;
    if (time?.endsWith("d")) ms = parseInt(time) * 86400000;

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

      const winner = users[Math.floor(Math.random() * users.length)];

      message.channel.send(`🏆 Kazanan: <@${winner}>`);
      delete giveaways[msgGiveaway.id];

    }, ms);
  }
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // ================= DROP CLAIM (FIXED) =================
  if (interaction.customId === "drop_claim") {

    if (!dropActive || dropClaimed) {
      return interaction.reply({
        content: "❌ Drop bitmiş!",
        ephemeral: true
      });
    }

    dropClaimed = true;
    dropActive = false;

    await interaction.update({
      content: `🏆 Kazanan: <@${interaction.user.id}>`,
      components: []
    });

    return interaction.channel.send(
      `🎊 <@${interaction.user.id}> ödülü kazandı!`
    );
  }

  // ================= GIVEAWAY =================
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

client.login(TOKEN);
