import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MysqlAdapter as Database } from '@builderbot/database-mysql'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import axios from 'axios'

const PORT = process.env.PORT ?? 3008

const spreadsheetId = '1gLq6h2Df9f1mvjDIN3XD6x7S_K4Fsl-Vkpo41nsbyb4'
const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`

const getSheetData = async () => {
    const response = await axios.get(sheetUrl)
    console.log("Response Data:", response.data)
    const jsonData = JSON.parse(response.data.substr(47).slice(0, -2))
    console.log("JSON Data:", JSON.stringify(jsonData))
    const rows = jsonData.table.rows
    return rows.slice(1).map(row => row.c.map(cell => (cell ? cell.v : ''))) // Omitir la primera fila (títulos)
}

const menuMessage = [
    '📱 Ofrecemos una amplia gama de celulares nuevos y usados.',
    '🔍 Para ver nuestros productos, escribe una de las siguientes palabras clave:',
    '✨ *nuevos* - para ver celulares nuevos',
    '♻️ *usados* - para ver celulares usados',
    '🛒 *productos* - para ver todos los productos disponibles',
    '📝 *menu* - para ver este menú nuevamente'
].join('\n')

const welcomeFlow = addKeyword(['hi', 'hello', 'hola', 'menu', 'buenas', 'buenas tardes', utils.setEvent('WELCOME_EVENT')])
    .addAnswer(`🙌 Hola, bienvenido a nuestra tienda tecnológica.`, { capture: false })
    .addAnswer(menuMessage, { delay: 800, capture: true })

const newPhonesFlow = addKeyword(['new phones', 'new', 'nuevos', utils.setEvent('NEW_PHONES_EVENT')])
    .addAnswer('📱 Estos son nuestros celulares nuevos disponibles:', { capture: false }, async (ctx, { flowDynamic }) => {
        const productData = await getSheetData()
        const newPhones = productData.filter(row => row[1].toLowerCase() === 'nuevo')
        const productList = newPhones.map((row, index) => `${index + 1}. ${row[0]} - ${row[2]}`).join('\n')
        await flowDynamic(productList)
    })
    .addAnswer(
        ['🤔 ¿Cuál producto te interesa?', '✍️ Escribe el número del producto para obtener más información.'].join('\n'),
        { delay: 800, capture: true },
        async (ctx, { flowDynamic, fallBack }) => {
            const productIndex = parseInt(ctx.body.trim()) - 1
            const productData = await getSheetData()
            const newPhones = productData.filter(row => row[1].toLowerCase() === 'nuevo')
            const product = newPhones[productIndex]

            if (product) {
                const [productName, productStatus, productValue, productDescription] = product
                const salesMessageResponse = await axios.post(
                    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Crea un mensaje de ventas para el siguiente producto lo mas corto posible y con emoticones: Nombre: ${productName}, Valor: ${productValue}, Estado: ${productStatus}, Descripción: ${productDescription}`
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        params: {
                            key: 'AIzaSyCionzzL4GRcjPQK21PxB3i3_Q-5HlpdNo'
                        }
                    }
                )
                const salesMessage = salesMessageResponse.data.candidates[0].content.parts[0].text
                await flowDynamic(salesMessage)
            } else {
                return fallBack('😔 Lo siento, no tenemos ese producto en nuestro inventario. Por favor, elige otro producto de la lista.')
            }
        }
    )

const usedPhonesFlow = addKeyword(['used phones', 'used', 'usados', utils.setEvent('USED_PHONES_EVENT')])
    .addAnswer('📱 Estos son nuestros celulares usados disponibles:', { capture: false }, async (ctx, { flowDynamic }) => {
        const productData = await getSheetData()
        const usedPhones = productData.filter(row => row[1].toLowerCase() === 'usado')
        const productList = usedPhones.map((row, index) => `${index + 1}. ${row[0]} - ${row[2]}`).join('\n')
        await flowDynamic(productList)
    })
    .addAnswer(
        ['🤔 ¿Cuál producto te interesa?', '✍️ Escribe el número del producto para obtener más información.'].join('\n'),
        { delay: 800, capture: true },
        async (ctx, { flowDynamic, fallBack }) => {
            const productIndex = parseInt(ctx.body.trim()) - 1
            const productData = await getSheetData()
            const usedPhones = productData.filter(row => row[1].toLowerCase() === 'usado')
            const product = usedPhones[productIndex]

            if (product) {
                const [productName, productStatus, productValue, productDescription] = product
                const salesMessageResponse = await axios.post(
                    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Crea un mensaje de ventas para el siguiente producto lo mas corto posible y con emoticones: Nombre: ${productName}, Valor: ${productValue}, Estado: ${productStatus}, Descripción: ${productDescription}`
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        params: {
                            key: 'AIzaSyCionzzL4GRcjPQK21PxB3i3_Q-5HlpdNo'
                        }
                    }
                )
                const salesMessage = salesMessageResponse.data.candidates[0].content.parts[0].text
                await flowDynamic(salesMessage)
            } else {
                return fallBack('😔 Lo siento, no tenemos ese producto en nuestro inventario. Por favor, elige otro producto de la lista.')
            }
        }
    )

const allProductsFlow = addKeyword(['products', 'productos', 'all', utils.setEvent('ALL_PRODUCTS_EVENT')])
    .addAnswer('🛒 Estos son todos nuestros productos disponibles:', { capture: false }, async (ctx, { flowDynamic }) => {
        const productData = await getSheetData()
        const productList = productData.map((row, index) => `${index + 1}. ${row[0]} - ${row[2]} (${row[1]})`).join('\n')
        const chunks = productList.match(/(.|[\r\n]){1,4096}/g) // Dividir en trozos de hasta 4096 caracteres
        for (const chunk of chunks) {
            await flowDynamic(chunk)
        }
    })
    .addAnswer(
        ['🤔 ¿Cuál producto te interesa?', '✍️ Escribe el número del producto para obtener más información.'].join('\n'),
        { delay: 800, capture: true },
        async (ctx, { flowDynamic, fallBack }) => {
            const productIndex = parseInt(ctx.body.trim()) - 1
            const productData = await getSheetData()
            const product = productData[productIndex]

            if (product) {
                const [productName, productStatus, productValue, productDescription] = product
                const salesMessageResponse = await axios.post(
                    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
                    {
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Crea un mensaje de ventas para el siguiente producto lo mas corto posible y con emoticones: Nombre: ${productName}, Valor: ${productValue}, Estado: ${productStatus}, Descripción: ${productDescription}`
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        params: {
                            key: 'AIzaSyCionzzL4GRcjPQK21PxB3i3_Q-5HlpdNo'
                        }
                    }
                )
                const salesMessage = salesMessageResponse.data.candidates[0].content.parts[0].text
                await flowDynamic(salesMessage)
            } else {
                return fallBack('😔 Lo siento, no tenemos ese producto en nuestro inventario. Por favor, elige otro producto de la lista.')
            }
        }
    )

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, newPhonesFlow, usedPhonesFlow, allProductsFlow])
    
    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database({
        host: "localhost",
        user: "root",
        database: "builderbot",
        password: "",
    })

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()