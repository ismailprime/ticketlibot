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
    GatewayIntentBits.GuildInvites // Davet takibi için kritik
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
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const OWNER_ID = "1003708560728920165";
const ADMIN_ROLE_ID = "1506368461964705924";

// Minecraft Sunucu Ayarları
const MC_IP = "mc.skyforgenw.com.tr";
const MC_PORT = 25565;

// ================= DATA SAKLAMA ALANLARI =================

const giveaways = {};
const activeTickets = new Map();
const invites = new Map();
const userInvites = new Map();
const activeDrops = new Map(); // Drop sistemi için

// ================= ZAMAN FONKSİYONU =================

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

// ================= READY (BOT AÇILIŞI) =================

client.once("ready", async () => {
  console.log(`${client.user.tag} aktif!`);

  // Mevcut davetleri hafızaya al
  client.guilds.cache.forEach(async (guild) => {
    const inv = await guild.invites.fetch().catch(() => {});
    if (inv) invites.set(guild.id, inv);
  });
});

// ================= LOG SİSTEMLERİ =================

// MESAJ SİLME LOGU
client.on("messageDelete", async (message) => {
  if (!message.guild) return;

  const log = message.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!log) return;

  let executor = "Bilinmiyor";

  try {
    const audit = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
    const entry = audit.entries.first();
    if (entry && entry.target.id === message.author.id) {
      executor = entry.executor.tag;
    }
  } catch {}

  log.send(`
🗑 *MESAJ SİLİNDİ*
👤 *Yazan:* ${message.author?.tag || "Bilinmiyor"}
🧨 *Silen:* ${executor}
💬 *İçerik:* ${message.content || "boş / medya"}
⏰ ${nowTime()}
  `).catch(() => {});
});

// MESAJ DÜZENLEME LOGU
client.on("messageUpdate", async (oldM, newM) => {
  if (!oldM.guild || oldM.author?.bot) return;
  if (oldM.content === newM.content) return;

  const log = oldM.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!log) return;

  log.send(`
✏ *MESAJ DÜZENLENDİ*
👤 *Kullanıcı:* ${oldM.author?.tag || "Bilinmiyor"}
📌 *ÖNCE:* ${oldM.content || "boş"}
📌 *SONRA:* ${newM.content || "boş"}
⏰ ${nowTime()}
  `).catch(() => {});
});

// ================= GİRİŞ VE DAVET SİSTEMİ =================

client.on("guildMemberAdd", async (member) => {
  // Rol Tanımlamaları
  member.roles.add(MEMBER_ROLE).catch(() => {});
  if (member.id === OWNER_ID) {
    member.roles.add(ADMIN_ROLE_ID).catch(() => {});
  }

  // Davet Takibi Hesabı
  let inviterText = "Bilinmiyor";
  try {
    const cachedInvites = invites.get(member.guild.id);
    const currentInvites = await member.guild.invites.fetch().catch(() => {});
    
    if (cachedInvites && currentInvites) {
      const usedInvite = currentInvites.find(inv => {
        const cached = cachedInvites.get(inv.code);
        return cached && inv.uses > cached.uses;
      });

      if (usedInvite && usedInvite.inviter) {
        const inviterId = usedInvite.inviter.id;
        const currentCount = userInvites.get(inviterId) || 0;
        userInvites.set(inviterId, currentCount + 1);
        inviterText = `${usedInvite.inviter.tag} (Davet Sayısı: ${currentCount + 1})`;
      }
      
      invites.set(member.guild.id, currentInvites);
    }
  } catch (err) {
    console.error("Davet hesaplama hatası:", err);
  }

  // Giriş Log Kanalı Bildirimi
  const log = member.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (log) {
    log.send(`📥 *GİRİŞ:* ${member.user.tag} | *Davet Eden:* ${inviterText} | ⏰ ${nowTime()}`).catch(() => {});
  }

  // Hoş Geldin Mesajı
  const channel = member.guild.channels.cache.find(c => c.name === "💬│genel-sohbet");
  if (channel) channel.send(`👋 Hoşgeldin <@${member.id}>`).catch(() => {});
});

// Yeni davet açıldığında listeyi tazele
client.on("inviteCreate", async (invite) => {
  const inv = await invite.guild.invites.fetch().catch(() => {});
  if (inv) invites.set(invite.guild.id, inv);
});

// ================= YAZILI KOMUTLAR (messageCreate) =================

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
  const msg = message.content.toLowerCase();

  // 1. SELAMLAŞMA
  if (["sa","selam","selamün aleyküm","selamun aleyküm"].includes(msg)) {
    return message.channel.send(`Aleyküm selam <@${message.author.id}>, hoşgeldin 👋`);
  }

  // 2. IP BİLGİSİ
  if (message.content === "!ip") {
    return message.channel.send(`
**Java Sürüm:** 1.9 - 1.21.x
\`mc.skyforgenw.com.tr\`

**Bedrock Port:** 19132
\`mc.skyforgenw.com.tr\`
    `);
  }

  // 3. MINECRAFT SUNUCU DURUMU
  if (message.content === "!durum") {
    const waitMsg = await message.channel.send("🔄 Sunucu durumu kontrol ediliyor, lütfen bekleyin...");

    try {
      const result = await mcstatus.statusJava(MC_IP, MC_PORT);

      if (result && result.online) {
        const statusEmbed = new EmbedBuilder()
          .setColor("#55FF55")
          .setTitle("🟢 SkyForgeNW Sunucu Durumu")
          .setDescription(`Sunucumuz şu anda **Aktif** ve oynanabilir durumda!`)
          .addFields(
            { name: "📶 Sunucu Adresi", value: `\`${MC_IP}\``, inline: true },
            { name: "👥 Çevrimiçi Oyuncu", value: `👥 **${result.players.online}** / **${result.players.max}**`, inline: true },
            { name: "🛠️ Sunucu Sürümü", value: `\`${result.version.name || "1.9 - 1.21.x"}\``, inline: true },
            { name: "⚡ Gecikme (Ping)", value: `\`${result.roundTripLatency || "Hesaplanamadı"}ms\``, inline: true }
          )
          .setThumbnail(message.guild.iconURL({ dynamic: true }))
          .setFooter({ text: `Sorgulayan: ${message.author.tag} | ${nowTime()}` });

        await waitMsg.delete().catch(() => {});
        return message.channel.send({ embeds: [statusEmbed] });
      } else {
        throw new Error("Sunucu kapalı");
      }
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#FF5555")
        .setTitle("🔴 SkyForgeNW Sunucu Durumu")
        .setDescription(`❌ Sunucuya şu anda ulaşılamıyor. Bakımda veya kapalı olabilir.`)
        .addFields({ name: "📶 Sunucu Adresi", value: `\`${MC_IP}\`` })
        .setFooter({ text: `${nowTime()}` });

      await waitMsg.delete().catch(() => {});
      return message.channel.send({ embeds: [errorEmbed] });
    }
  }

  // 4. GELİŞMİŞ REFLAKS DROP SİSTEMİ
  if (message.content.startsWith("!drop")) {
    if (!isAdmin) return;

    const args = message.content.split(" ");
    const prize = args.slice(1).join(" ");

    if (!prize) return message.reply("❌ Doğru kullanım: `!drop Ödül İçeriği` \nÖrn: `!drop 1 Aylık VIP Üyelik + 50.000 Oyun Parası`");

    const dropEmbed = new EmbedBuilder()
      .setColor("#FFAA00")
      .setTitle("📦 REFLEKS YARIŞI: HIZLI DROP BAŞLADI!")
      .setDescription(`Aşağıdaki butona **İLK BASAN** kazanır! Acele et!\n\n🎁 **Düşen Ödülün İçeriği:**\n> ${prize}`)
      .setFooter({ text: `Yönetici: ${message.author.tag} | Başlangıç: ${nowTime()}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_drop")
        .setLabel("🎁 Kutuya Tıkla ve Ödülü Kap!")
        .setStyle(ButtonStyle.Primary)
    );

    const dropMessage = await message.channel.send({
      content: "📢 @everyone @here sunucuda hızlı drop başladı, butona ilk basan ödülü kapıyor!",
      embeds: [dropEmbed],
      components: [row]
    });

    activeDrops.set(dropMessage.id, { prize: prize, claimed: false });
  }

  // 5. DAVET SORGULAMA
  if (message.content === "-i") {
    const count = userInvites.get(message.author.id) || 0;
    return message.channel.send(`📨 Davet sayın: **${count}**`);
  }

  // 6. TICKET PANEL KURULUMU
  if (message.content === "!ticketpanel") {
    if (!isAdmin) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open_menu")
        .setLabel("🎫 Ticket Aç")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
      content: "🎫 **Ticket sistemi aktif! Destek talebi oluşturmak için aşağıdaki butona tıklayın.**",
      components: [row]
    });
  }

  // 7. Gelişmiş ÇEKİLİŞ SİSTEMİ
  if (message.content.startsWith("!cekilis")) {
    if (!isAdmin) return;

    const args = message.content.split(" ");
    const time = args[1];
    const prize = args.slice(2).join(" ");

    if (!time || !prize) return message.reply("❌ Doğru kullanım: `!cekilis 10m Ödül İsmi` (m: dakika, h: saat, d: gün)");

    let ms = 0;
    const timeNum = parseInt(time);
    if (time.endsWith("m")) ms = timeNum * 60000;
    else if (time.endsWith("h")) ms = timeNum * 3600000;
    else if (time.endsWith("d")) ms = timeNum * 86400000;
    else return message.reply("❌ Geçersiz süre formatı! Örn: `5m`, `2h`, `1d`");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("join_giveaway")
        .setLabel("🎉 Katıl")
        .setStyle(ButtonStyle.Success)
    );

    const msgGiveaway = await message.channel.send({
      content: `🎉 **ÇEKİLİŞ BAŞLADI** 🎉\n\n🎁 **Ödül:** ${prize}\n⏰ **Süre:** ${time}\n\nKatılmak için aşağıdaki butona tıklayın!`,
      components: [row]
    });

    giveaways[msgGiveaway.id] = [];

    setTimeout(async () => {
      const fetchedMsg = await message.channel.messages.fetch(msgGiveaway.id).catch(() => null);
      const users = giveaways[msgGiveaway.id];

      if (!users || users.length === 0) {
        if (fetchedMsg) fetchedMsg.edit({ content: "❌ Çekiliş iptal edildi, kimse katılmadı.", components: [] });
        return message.channel.send("❌ Çekilişe kimse katılmadığı için kazanan seçilemedi.");
      }

      const winner = users[Math.floor(Math.random() * users.length)];

      if (fetchedMsg) {
        fetchedMsg.edit({ content: `🎉 **ÇEKİLİŞ SONUÇLANDI** 🎉\n\n🎁 **Ödül:** ${prize}\n🏆 **Kazanan:** <@${winner}>`, components: [] }).catch(() => {});
      }
      
      message.channel.send(`🏆 Tebrikler <@${winner}>! **${prize}** ödülünü kazandın!`);
      delete giveaways[msgGiveaway.id];
    }, ms);
  }
});

// ================= BUTON VE MENÜ ETKİLEŞİMLERİ (interactionCreate) =================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  // DROP KAPMA BUTON ETKİLEŞİMİ
  if (interaction.customId === "claim_drop") {
    const dropData = activeDrops.get(interaction.message.id);

    if (!dropData) {
      return interaction.reply({ content: "❌ Bu drop artık aktif değil veya silinmiş.", ephemeral: true });
    }

    if (dropData.claimed) {
      return interaction.reply({ content: "❌ Çok geç kaldın! Ödül başka bir oyuncu tarafından kapıldı.", ephemeral: true });
    }

    // İlk basanı kaydet ve kilitle
    dropData.claimed = true;
    activeDrops.set(interaction.message.id, dropData);

    // Butonu Devre Dışı Bırak
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_drop_disabled")
        .setLabel("📦 Ödül Kapıldı!")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // Kutu Tasarımını "Sona Erdi" Olarak Düzenle
    const editEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor("#555555")
      .setTitle("📦 DROP SONA ERDİ")
      .setDescription(`🏆 **Ödül Sahibi Buldu!**\n\n🎁 **Kazanılan Ödül:**\n> ${dropData.prize}\n\n👑 **Şanslı Kişi:** <@${interaction.user.id}>`);

    await interaction.message.edit({ 
      content: "🏁 Drop sona erdi! Kazanan aşağıda belirtilmiştir.", 
      embeds: [editEmbed], 
      components: [disabledRow] 
    }).catch(() => {});

    activeDrops.delete(interaction.message.id);

    // Belirttiğin Kazanan Etiketli Bildirim Mesajı
    return interaction.reply({
      content: `🎉 Tebrikler <@${interaction.user.id}>! **${dropData.prize}** ödülünü ilk sen kaptın! 🎫 Ticket açarak hediyeni alabilirsin.`
    });
  }

  // TICKET KATEGORİ SEÇİM PANELİNİ AÇMA
  if (interaction.customId === "ticket_open_menu") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Lütfen bir kategori seçin...")
      .addOptions(
        { label: "Destek", value: "destek", emoji: "🛠️" },
        { label: "Bug Bildirimi", value: "bug", emoji: "🐛" },
        { label: "Şikayet", value: "sikayet", emoji: "⚖️" },
        { label: "Diğer", value: "diger", emoji: "📁" }
      );

    return interaction.reply({
      content: "Lütfen talep açmak istediğiniz kategoriyi seçin:",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  // ÇEKİLİŞE KATILMA BUTONU
  if (interaction.customId === "join_giveaway") {
    const users = giveaways[interaction.message.id];

    if (!users) return interaction.reply({ content: "❌ Bu çekiliş çoktan sona ermiş.", ephemeral: true });

    if (users.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Zaten bu çekilişe katılmışsın!", ephemeral: true });
    }

    users.push(interaction.user.id);
    return interaction.reply({ content: "✅ Çekilişe başarıyla katıldın! Bol şans. 🎉", ephemeral: true });
  }

  // TICKET KANALI OLUŞTURMA SÜRECİ
  if (interaction.customId === "ticket_category") {
    const category = interaction.values[0];
    const userId = interaction.user.id;

    if (activeTickets.has(userId)) {
      return interaction.reply({
        content: "❌ Zaten açık bir destek talebiniz bulunuyor!",
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${category}-${interaction.user.username}`,
      type: 0, // GuildText
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });

    activeTickets.set(userId, channel.id);

    await channel.send({
      content: `🎫 **Destek Kanalı Açıldı**\n📂 **Kategori:** ${category}\n<@${userId}> En kısa sürede yetkililer sizinle ilgilenecektir.`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Kanalı Kapat")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    });

    return interaction.reply({
      content: `✅ Destek talebiniz başarıyla oluşturuldu: ${channel}`,
      ephemeral: true
    });
  }

  // TICKET KAPATMA BUTONU
  if (interaction.customId === "ticket_close") {
    const owner = [...activeTickets.entries()].find(x => x[1] === interaction.channel.id);
    if (owner) activeTickets.delete(owner[0]);

    await interaction.reply("🔒 Destek kanalı 2 saniye içinde siliniyor...");

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  }
});

// ================= BOT GİRİŞİ =================

client.login(TOKEN);
                           
