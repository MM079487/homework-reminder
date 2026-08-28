import { getStore } from "@netlify/blobs";

const store =
    getStore("homework");

const DATA_KEY =
    "homework-data";

const WEBHOOK_URL =
    process.env.DISCORD_WEBHOOK_URL;


// --------------------------------------------------
// Load database
// --------------------------------------------------

async function loadDatabase() {

    const data =
        await store.get(
            DATA_KEY,
            {
                type: "json",
                consistency: "strong"
            }
        );


    if (!data) {

        return {
            homework: [],
            discordMessageId: null
        };
    }


    return {

        homework:
            Array.isArray(data.homework)
                ? data.homework
                : [],

        discordMessageId:
            data.discordMessageId || null
    };
}


// --------------------------------------------------
// Build embed
// --------------------------------------------------

function buildEmbed(homework) {

    if (homework.length === 0) {

        return {

            title:
                "📚 Homework Reminders",

            description:
                "🎉 No homework currently!",

            color:
                0xED4245,

            footer: {
                text:
                    "Total homework: 0"
            },

            timestamp:
                new Date().toISOString()
        };
    }


    let description = "";

    for (
        let i = 0;
        i < homework.length;
        i++
    ) {

        const item =
            homework[i];


        let section =
            `**${i + 1}. ${item.title}**\n` +
            `> Due ` +
            `<t:${item.timestamp}:F>` +
            ` (<t:${item.timestamp}:R>)`;


        if (item.note) {

            section +=
                `\n> ${item.note}`;
        }


        const addition =
            description
                ? `\n\n${section}`
                : section;


        if (
            description.length +
            addition.length >
            3900
        ) {

            description +=
                "\n\n*Some homework is hidden because the list is too large for one Discord embed.*";

            break;
        }


        description +=
            addition;
    }


    return {

        title:
            "📚 Homework Reminders",

        description:
            description,

        color:
            0xED4245,

        footer: {
            text:
                `Total homework: ${homework.length}`
        },

        timestamp:
            new Date().toISOString()
    };
}


// --------------------------------------------------
// Update Discord
// --------------------------------------------------

async function syncDiscord(data) {

    if (!WEBHOOK_URL) {

        throw new Error(
            "DISCORD_WEBHOOK_URL is not configured."
        );
    }


    const embed =
        buildEmbed(
            data.homework
        );


    // ----------------------------------------------
    // Update existing message
    // ----------------------------------------------

    if (data.discordMessageId) {

        const editUrl =
            `${WEBHOOK_URL}/messages/` +
            `${data.discordMessageId}`;


        const response =
            await fetch(
                editUrl,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        username:
                            "Homework Reminder",

                        embeds:
                            [embed],

                        allowed_mentions: {
                            parse: []
                        }
                    })
                }
            );


        if (response.ok) {
            return;
        }


        // Discord message no longer exists
        if (
            response.status !== 404
        ) {

            throw new Error(
                "Failed to update Discord."
            );
        }


        data.discordMessageId =
            null;
    }


    // ----------------------------------------------
    // Create new message
    // ----------------------------------------------

    const response =
        await fetch(
            `${WEBHOOK_URL}?wait=true`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    username:
                        "Homework Reminder",

                    embeds:
                        [embed],

                    allowed_mentions: {
                        parse: []
                    }
                })
            }
        );


    if (!response.ok) {

        const error =
            await response.text();

        console.error(
            "Discord error:",
            error
        );

        throw new Error(
            "Failed to create Discord message."
        );
    }


    const message =
        await response.json();


    data.discordMessageId =
        message.id;
}


// --------------------------------------------------
// Scheduled cleanup
// --------------------------------------------------

export default async function () {

    try {

        const data =
            await loadDatabase();


        const now =
            Math.floor(
                Date.now() / 1000
            );


        const oldCount =
            data.homework.length;


        // Remove overdue homework
        data.homework =
            data.homework.filter(
                item =>
                    Number(item.timestamp) > now
            );


        // Sort remaining homework
        data.homework.sort(
            (a, b) =>
                Number(a.timestamp) -
                Number(b.timestamp)
        );


        // Nothing expired
        if (
            data.homework.length ===
            oldCount
        ) {

            console.log(
                "No overdue homework."
            );

            return;
        }


        console.log(
            `Removed ${
                oldCount -
                data.homework.length
            } overdue homework.`
        );


        // Update Discord
        await syncDiscord(data);


        // Save new JSON
        await store.setJSON(
            DATA_KEY,
            data
        );


        console.log(
            "Cleanup completed."
        );


    } catch (error) {

        console.error(
            "Cleanup error:",
            error
        );
    }
}


// Run every 5 minutes
export const config = {
    schedule: "*/5 * * * *"
};