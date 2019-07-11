const { Client, RichEmbed, Util } = require('discord.js');
const { Token, PREFIX, Google_api_key } = require('./config.js');
const ascii = require('ascii-art');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const queue = new Map();

const youtube = new YouTube(Google_api_key);

const client = new Client({ disabledEveryone: true });

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log(`${client.user.username} is ready !`));

client.on('disconnect', () => console.log('Disconnected'));

client.on('reconnecting', () => console.log('Reconnect'));

client.on('message', async msg => {
    if (msg.author.bot) return undefined;
    if (!msg.content.startsWith(PREFIX)) return undefined;
    const args = msg.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
    const serverQueue = queue.get(msg.guild.id);

    if (msg.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = msg.member.voiceChannel;
        if (!voiceChannel) return msg.channel.send(':x: Désolée mais tu n\'es pas dans un channel vocal. 0_0');
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has('CONNECT')) {
            return msg.channel.send(':x: Je n\'ai pas la permission de me connecter. 0_0');
        }
        if (!permissions.has('SPEAK')) {
            return msg.channel.send(':x: Je n\'ai pas la permission de parler. 0_0');
        }

        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id);
                await handleVideo(video2, msg, voiceChannel, true);
            }
            return msg.channel.send(`:white_check_mark: La playlist ***${playlist.title}*** à bien été ajoutée à la queue.`);

        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    const embed = new RichEmbed()
                        .setTitle(':notes: __***Séléction :***__')
                        .setColor(0xFF00CA)
                        .setDescription(`
${videos.map(video2 => `${++index} - *${video2.title}*`).join('\n')}
***Entre un chiffre entre 1 et 10 pour choisir la musique dans la séléction.***
                        `)
                    msg.channel.send(embed)

                try {
                    var responce = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
                        maxMatches: 1,
                        time: 10000,
                        errors: ['time']
                    });
                } catch (err) {
                    console.error(err);
                    return msg.channel.send(':x: Temps écoulé ou mauvais choix, séléction terminée.');
                }
                const videoIndex = parseInt(responce.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err)
                    return msg.channel.send(':x: Je n\'ai pas trouvé de résultats. 0_0')
                }
            }

            return handleVideo(video, msg, voiceChannel);
        }
    } else if (msg.content.startsWith(`${PREFIX}ascii`)) {
        ascii.font(args.join(' '), 'Doom', function(rendered) {
            rendered = rendered.trimRight();
            if (rendered.length > 2000) return msg.channel.send(':x: Désolée, ce texte est trop long. 0_0');
            msg.channel.send(rendered, {
                code: 'md'
            });
        })
    } else if (msg.content.startsWith(`${PREFIX}stop`)) {
        if (!msg.member.voiceChannel) return msg.channel.send(':x: Tu n\'es pas dans un channel vocal. 0_0');
        if (!serverQueue) return msg.channel.send(':x: Il n\'y à aucunes musique à stopper. 0_0');
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end(':white_check_mark: Musique stoppée.');
        return undefined;
    } else if(msg.content.startsWith(`${PREFIX}skip`)) {
        if (!msg.member.voiceChannel) return msg.channel.send(':x: Tu n\'es pas dans un channel vocal. 0_0');
        if (!serverQueue) return msg.channel.send(':x: Il n\'y à aucunes musique à skip. 0_0');
        serverQueue.connection.dispatcher.end(':white_check_mark: Musique skip.');
        return undefined;
    } else if (msg.content.startsWith(`${PREFIX}volume`)) {
        if (!serverQueue) return msg.channel.send(':x: Il n\'y à aucunes musiques en cours. 0_0');
        if (!args[1]) return msg.channel.send(`Le volume actuel est à ${serverQueue.volume}`);
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
        return msg.channel.send(`:white_check_mark: Le volume est désormais à ${args[1]}`);
    } else if (msg.content.startsWith(`${PREFIX}np`)) {
        if (!serverQueue) return msg.channel.send(':x: Il n\'y à aucunes musiques en cours. 0_0');
        return msg.channel.send(`:notes: Maintenant en cours de diffusion : ***${serverQueue.songs[0].title}***`);
    } else if (msg.content.startsWith(`${PREFIX}queue`)) {
        if (!serverQueue) return msg.channel.send(':x: Il n\'y à aucunes musiques en cours. 0_0');
        if (!msg.member.voiceChannel) return msg.channel.send(':x: Tu n\'es pas dans un channel vocal. 0_0');
        const embed2 = new RichEmbed()
    .setTitle('__***Queue :***__')
    .setColor(0xFF00CA)
    .setDescription(`
    ${serverQueue.songs.map(song => `- *${song.title}*`).join('\n')}
    ***Maintenant en cours :*** *${serverQueue.songs[0].title}* `)
        return msg.channel.send(embed2);
    } else if (msg.content.startsWith(`${PREFIX}pause`)) {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return msg.channel.send(':white_check_mark: La musique est en pause.');
        }
        return msg.channel.send(':x: Il n\'y à aucunes musiques en cours. 0_0');
    } else if (msg.content.startsWith(`${PREFIX}resume`)) {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return msg.channel.send(':white_check_mark: La musique est de nouveau en cours de diffusion.');
        }
        return msg.channel.send(':x: Il n\'y à aucunes musiques en cours. 0_0');
    }

    return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
    const serverQueue = queue.get(msg.guild.id);
    console.log(video);
    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    };

    if (!serverQueue) {
        const queueConstruct = {
            textChannel: msg.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };
        queue.set(msg.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(msg.guild, queueConstruct.songs[0]);
        } catch (error) {
            console.error(`Je n\'ai pas pu rejoindre le channel vocal. 0_0 ${error}`);
            queue.delete(msg.guild.id);
            return msg.channel.send(`:x: Je n\'ai pas pu rejoindre le channel vocal. 0_0 ${error}`);
        }
    } else {
        serverQueue.songs.push(song);
        if (playlist) return undefined;
        else return msg.channel.send(`:white_check_mark: ***${song.title}*** à été ajoutée à la queue.`);
    }
    return undefined;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
    console.log(serverQueue.songs);

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
        .on('end', reason => {
            console.log(reason);
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => console.log(error));
    dispatcher.setVolumeLogarithmic(5 / 5);

    serverQueue.textChannel.send(`:notes: Maintenant en cours de diffusion : ***${song.title}***`);
}

client.login(Token);





