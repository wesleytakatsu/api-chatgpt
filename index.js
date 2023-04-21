const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const axios = require('axios')
require('dotenv').config()

const client = new Client({
    authStrategy: new LocalAuth()
})

client.on('qr', qr => {
    qrcode.generate(qr, {small: true})
});

client.on('authenticated', (session) => console.log(`Autenticado`))

client.on('ready', () => console.log('O WhatsApp com o ChatGPT está pronto'))

client.on('message_create', message => commands(message))

client.initialize();


const headers = {
    'Authorization': `Bearer ${process.env.OPENAI_KEY}`,
    'OpenAI-Organization': `${process.env.OPENAI_ORGANIZATION}`,
    'Content-Type': 'application/json'
}

const axiosInstance = axios.create({
    baseURL: 'https://api.openai.com/',
    timeout: 120000,
    headers: headers
});

const getDavinciResponse = async (clientText) => {
    const body = {
        "model": "gpt-3.5-turbo",
        "messages": [{
            "role": "user",
            "content": clientText,
        }],
        "max_tokens": 50,
        //"temperature": 1
    }

    try {
        const { data } = await axiosInstance.post('v1/chat/completions', body)
        const botAnswer = data.choices[0].message.content
        const botTokensUsados = data.usage.total_tokens
        console.log('Foi usado o total de ' + botTokensUsados + ' tokens')
        var valorTokensGastos = botTokensUsados/1000*0.01
        console.log('Custo de ' + valorTokensGastos + ' reais')
        console.log(botAnswer)
        return `🤖 IA do Professor Wesley:\n${botAnswer} \n\nTokens usados: ${botTokensUsados}\nCusto R$${valorTokensGastos}`
    } catch (e) {
        return `❌ OpenAI Response Error`
    }
}

const getDalleResponse = async (clientText) => {
    const body = {
        prompt: clientText, // Descrição da imagem
        n: 1, // Número de imagens a serem geradas
        size: "256x256", // Tamanho da imagem
    }
    
    try {
        const { data } = await axiosInstance.post('v1/images/generations', body)
        return data.data[0].url
    } catch (e) {
        return `❌ OpenAI Response Error`
    }
}

const commands = async (message) => {
    const iaCommands = {
        davinci3: "/bot",
        dalle: "/img",
    }
    let firstWord = message.body.substring(0, message.body.indexOf(" "))

    
    const sender = message.from.includes(process.env.PHONE_NUMBER) ? message.to : message.from
    switch (firstWord) {
        case iaCommands.davinci3:
            const question = message.body.substring(message.body.indexOf(" "));
            getDavinciResponse(question).then(async (response) => {
                const contact = await message.getContact()
                client.sendMessage(sender, `${response}\n\n_Resposta requisitada por @${contact.id.user}_`, { mentions: [contact] })
            })
            break

        case iaCommands.dalle:
            const imgDescription = message.body.substring(message.body.indexOf(" "));
            const contact = await message.getContact();
            getDalleResponse(imgDescription, message).then(async (imgUrl)  => {
                const media = await MessageMedia.fromUrl(imgUrl)
                // Caso queira mandar como Sticker, acrescente em options -> sendMediaAsSticker: true
                const options = {
                    mentions: [contact], 
                    caption: `_IA do Prof Wesley.\nResposta requisitada por @${contact.id.user}_`, 
                    media: media,
                }
                await client.sendMessage(sender, media, options)
            })
            break
    }
}
