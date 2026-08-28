import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const store = getStore("homework");
const DATA_KEY = "homework-data";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;


// --------------------------------------------------
// JSON response helper
// --------------------------------------------------

function json(data, status = 200) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type": "application/json"
            }
        }
    );
}


// --------------------------------------------------
// Load database
// --------------------------------------------------

async function loadDatabase() {

    const data = await store.get(
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
        homework: Array.isArray(data.homework)
            ? data.homework
            : [],

        discordMessageId:
            data.discordMessageId || null
    };
}


// --------------------------------------------------
// Save database
// --------------------------------------------------

async function saveDatabase(data) {

    await store.setJSON(
        DATA_KEY,
        data
    );
}


// --------------------------------------------------
// Sort homework by due date
// --------------------------------------------------

function sortHomework(homework) {

    homework.sort(
        (a, b) =>
            Number(a.timestamp) -
            Number(b.timestamp)
    );
}


// --------------------------------------------------
// Remove overdue homework
// --------------------------------------------------

function removeOverdueHomework(data) {

    const now =
        Math.floor(Date.now() / 1000);

    const oldLength =
        data.homework.length;

    data.homework =
        data.homework.filter(
            item =>
                Number(item.timestamp) > now
        );

    sortHomework(data.homework);

    return data.homework.length !== oldLength;
}


// --------------------------------------------------
// Build Discord embed
// --------------------------------------------------

function buildEmbed(homework) {

    if (homework.length === 0) {

        return {
            title: "📚 Homework Reminders",

            description:
                "🎉 No homework currently!",

            color: 0xED4245,

            footer: {
                text: "Total homework: 0"
            },

            timestamp:
                new Date().toISOString()
        };
    }


    let description = "";

    for (let i = 0; i < homework.length; i++) {

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


        // Discord embed description limit
        if (
            description.length +
            addition.length >
            3900
        ) {

            description +=
                "\n\n*Some homework is hidden because the list is too large for one Discord embed.*";

            break;
        }


        description += addition;
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
// Sync Discord message
// --------------------------------------------------

async function syncDiscord(data) {

    if (!WEBHOOK_URL) {

        throw new Error(
            "DISCORD_WEBHOOK_URL is not configured."
        );
    }


    const embed =
        buildEmbed(data.homework);


    // ----------------------------------------------
    // Update existing Discord message
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


        // Message was manually deleted
        if (response.status !== 404) {

            const errorText =
                await response.text();

            console.error(
                "Discord edit error:",
                errorText
            );

            throw new Error(
                "Failed to update Discord."
            );
        }


        data.discordMessageId = null;
    }


    // ----------------------------------------------
    // Create new Discord message
    // ----------------------------------------------

    const createUrl =
        `${WEBHOOK_URL}?wait=true`;


    const response =
        await fetch(
            createUrl,
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

        const errorText =
            await response.text();

        console.error(
            "Discord create error:",
            errorText
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
// Main function
// --------------------------------------------------

export default async function (req) {

    try {

        // ==========================================
        // GET
        // ==========================================

        if (req.method === "GET") {

            const data =
                await loadDatabase();


            // Remove anything overdue
            const changed =
                removeOverdueHomework(data);


            // Update Discord if something expired
            if (changed) {

                await syncDiscord(data);

                await saveDatabase(data);
            }


            return json({
                success: true,
                homework:
                    data.homework
            });
        }


        // ==========================================
        // POST
        // ==========================================

        if (req.method !== "POST") {

            return json(
                {
                    error:
                        "Method not allowed."
                },
                405
            );
        }


        const body =
            await req.json();


        const action =
            body.action;


        const data =
            await loadDatabase();


        // ------------------------------------------
        // Clean old homework first
        // ------------------------------------------

        const hadExpiredHomework =
            removeOverdueHomework(data);


        if (hadExpiredHomework) {

            await syncDiscord(data);

            await saveDatabase(data);
        }


        // ==========================================
        // ADD
        // ==========================================

        if (action === "add") {

            const title =
                body.title?.trim();

            const note =
                body.note?.trim() || "";

            const timestamp =
                Number(body.timestamp);


            if (!title) {

                return json(
                    {
                        error:
                            "Title is required."
                    },
                    400
                );
            }


            if (
                !Number.isFinite(timestamp)
            ) {

                return json(
                    {
                        error:
                            "Invalid date."
                    },
                    400
                );
            }


            if (
                timestamp <=
                Math.floor(
                    Date.now() / 1000
                )
            ) {

                return json(
                    {
                        error:
                            "Due date must be in the future."
                    },
                    400
                );
            }


            data.homework.push({

                id:
                    crypto.randomUUID(),

                title:
                    title,

                note:
                    note,

                timestamp:
                    timestamp,

                createdAt:
                    new Date().toISOString()
            });


            sortHomework(
                data.homework
            );


            await syncDiscord(data);

            await saveDatabase(data);


            return json({
                success: true,
                homework:
                    data.homework
            });
        }


        // ==========================================
        // EDIT
        // ==========================================

        if (action === "edit") {

            const id =
                body.id;

            const title =
                body.title?.trim();

            const note =
                body.note?.trim() || "";

            const timestamp =
                Number(body.timestamp);


            if (!id) {

                return json(
                    {
                        error:
                            "Homework ID is required."
                    },
                    400
                );
            }


            if (!title) {

                return json(
                    {
                        error:
                            "Title is required."
                    },
                    400
                );
            }


            if (
                !Number.isFinite(timestamp)
            ) {

                return json(
                    {
                        error:
                            "Invalid date."
                    },
                    400
                );
            }


            if (
                timestamp <=
                Math.floor(
                    Date.now() / 1000
                )
            ) {

                return json(
                    {
                        error:
                            "Due date must be in the future."
                    },
                    400
                );
            }


            const item =
                data.homework.find(
                    homework =>
                        homework.id === id
                );


            if (!item) {

                return json(
                    {
                        error:
                            "Homework not found."
                    },
                    404
                );
            }


            item.title =
                title;

            item.note =
                note;

            item.timestamp =
                timestamp;

            item.updatedAt =
                new Date().toISOString();


            sortHomework(
                data.homework
            );


            await syncDiscord(data);

            await saveDatabase(data);


            return json({
                success: true,
                homework:
                    data.homework
            });
        }


        // ==========================================
        // DELETE
        // ==========================================

        if (action === "delete") {

            const id =
                body.id;


            if (!id) {

                return json(
                    {
                        error:
                            "Homework ID is required."
                    },
                    400
                );
            }


            const originalLength =
                data.homework.length;


            data.homework =
                data.homework.filter(
                    item =>
                        item.id !== id
                );


            if (
                data.homework.length ===
                originalLength
            ) {

                return json(
                    {
                        error:
                            "Homework not found."
                    },
                    404
                );
            }


            sortHomework(
                data.homework
            );


            await syncDiscord(data);

            await saveDatabase(data);


            return json({
                success: true,
                homework:
                    data.homework
            });
        }


        return json(
            {
                error:
                    "Unknown action."
            },
            400
        );


    } catch (error) {

        console.error(
            "Function error:",
            error
        );


        return json(
            {
                error:
                    error.message ||
                    "Internal server error."
            },
            500
        );
    }
}