import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";


const DATA_KEY =
    "homework-data";


const WEBHOOK_URL =
    process.env.DISCORD_WEBHOOK_URL;


// --------------------------------------------------
// Response helper
// --------------------------------------------------

function json(
    data,
    status = 200
) {

    return new Response(
        JSON.stringify(data),
        {
            status: status,

            headers: {
                "Content-Type":
                    "application/json"
            }
        }
    );
}


// --------------------------------------------------
// Retry helper
// --------------------------------------------------

async function withRetry(
    operation,
    attempts = 3
) {

    let lastError;


    for (
        let attempt = 1;
        attempt <= attempts;
        attempt++
    ) {

        try {

            return await operation();

        } catch (error) {

            lastError =
                error;


            console.error(
                `Attempt ${attempt}/${attempts} failed:`,
                error
            );


            if (
                attempt <
                attempts
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            attempt * 1000
                        )
                );
            }
        }
    }


    throw lastError;
}


// --------------------------------------------------
// Load data
// --------------------------------------------------

async function loadData(
    store
) {

    const data =
        await withRetry(
            () =>
                store.get(
                    DATA_KEY,
                    {
                        type: "json",
                        consistency:
                            "strong"
                    }
                )
        );


    if (
        !data ||
        typeof data !==
            "object"
    ) {

        return {

            homework: [],

            discordMessageId:
                null
        };
    }


    return {

        homework:
            Array.isArray(
                data.homework
            )
                ? data.homework
                : [],

        discordMessageId:
            data.discordMessageId ||
            null
    };
}


// --------------------------------------------------
// Save data
// --------------------------------------------------

async function saveData(
    store,
    data
) {

    await withRetry(
        () =>
            store.setJSON(
                DATA_KEY,
                data
            )
    );
}


// --------------------------------------------------
// Sort
// --------------------------------------------------

function sortHomework(
    homework
) {

    homework.sort(
        (a, b) =>
            Number(
                a.timestamp
            ) -
            Number(
                b.timestamp
            )
    );
}


// --------------------------------------------------
// Create Discord embed
// --------------------------------------------------

function createEmbed(
    homework
) {

    if (
        homework.length ===
        0
    ) {

        return {

            title:
                "📚 Homework Reminders",

            description:
                "🎉 No homework currently!",

            color:
                0xFF0000,

            footer: {

                text:
                    "Total homework: 0"
            },

            timestamp:
                new Date()
                    .toISOString()
        };
    }


    let description =
        "";


    for (
        let i = 0;
        i < homework.length;
        i++
    ) {

        const item =
            homework[i];


        const overdue =
            Number(
                item.timestamp
            ) <=
            Math.floor(
                Date.now() / 1000
            );


        let section =
            overdue
                ? `⚠️ **${item.title}**\n`
                : `**${item.title}**\n`;


        if (overdue) {

            section +=
                `> **Overdue** · ` +
                `<t:${item.timestamp}:F> ` +
                `(<t:${item.timestamp}:R>)`;

        } else {

            section +=
                `> Due ` +
                `<t:${item.timestamp}:F> ` +
                `(<t:${item.timestamp}:R>)`;
        }


        if (item.note) {

            const noteLines =
                String(item.note)
                    .split("\n")
                    .map(
                        line =>
                            `> ${line}`
                    )
                    .join("\n");


            section +=
                `\n${noteLines}`;
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
                "\n\n*Some homework is not shown because the list is too large for one Discord embed.*";

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
            0xFF0000,

        footer: {

            text:
                `Total homework: ${homework.length}`
        },

        timestamp:
            new Date()
                .toISOString()
    };
}


// --------------------------------------------------
// Sync Discord
// --------------------------------------------------

async function syncDiscord(
    data
) {

    if (!WEBHOOK_URL) {

        throw new Error(
            "DISCORD_WEBHOOK_URL is not configured."
        );
    }


    const embed =
        createEmbed(
            data.homework
        );


    // ----------------------------------------------
    // Update existing message
    // ----------------------------------------------

    if (
        data.discordMessageId
    ) {

        const editURL =
            `${WEBHOOK_URL}/messages/` +
            `${data.discordMessageId}`;


        const response =
            await fetch(
                editURL,
                {
                    method:
                        "PATCH",

                    headers: {

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            username:
                                "Homework Reminder",

                            embeds:
                                [embed],

                            allowed_mentions: {

                                parse:
                                    []
                            }
                        })
                }
            );


        if (
            response.ok
        ) {

            return;
        }


        // Message was deleted manually
        if (
            response.status ===
            404
        ) {

            data.discordMessageId =
                null;

        } else {

            const errorText =
                await response.text();


            console.error(
                "Discord PATCH error:",
                errorText
            );


            throw new Error(
                "Failed to update Discord."
            );
        }
    }


    // ----------------------------------------------
    // Create Discord message
    // ----------------------------------------------

    const createURL =
        `${WEBHOOK_URL}?wait=true`;


    const response =
        await fetch(
            createURL,
            {
                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

                        username:
                            "Homework Reminder",

                        embeds:
                            [embed],

                        allowed_mentions: {

                            parse:
                                []
                        }
                    })
            }
        );


    if (
        !response.ok
    ) {

        const errorText =
            await response.text();


        console.error(
            "Discord POST error:",
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
// Main Netlify Function
// --------------------------------------------------

export default async function (
    req
) {

    /*
     * IMPORTANT:
     *
     * Create the Blobs store INSIDE every
     * Function invocation.
     *
     * This avoids keeping one store/client
     * object around between warm invocations.
     */

    const store =
        getStore(
            "homework"
        );


    try {

        // ==========================================
        // GET
        // ==========================================

        if (
            req.method ===
            "GET"
        ) {

            const data =
                await loadData(
                    store
                );


            sortHomework(
                data.homework
            );


            return json({

                success:
                    true,

                homework:
                    data.homework
            });
        }


        // ==========================================
        // POST
        // ==========================================

        if (
            req.method ===
            "POST"
        ) {

            const body =
                await req.json();


            const action =
                body.action;


            const data =
                await loadData(
                    store
                );


            // ======================================
            // REFRESH
            // ======================================

            if (
                action ===
                "refresh"
            ) {

                sortHomework(
                    data.homework
                );


                await syncDiscord(
                    data
                );


                await saveData(
                    store,
                    data
                );


                return json({

                    success:
                        true,

                    homework:
                        data.homework
                });
            }


            // ======================================
            // ADD
            // ======================================

            if (
                action ===
                "add"
            ) {

                const title =
                    body.title?.trim();


                const note =
                    body.note?.trim() ||
                    "";


                const timestamp =
                    Number(
                        body.timestamp
                    );


                if (
                    !title
                ) {

                    return json(
                        {
                            error:
                                "Title is required."
                        },
                        400
                    );
                }


                if (
                    !Number.isFinite(
                        timestamp
                    )
                ) {

                    return json(
                        {
                            error:
                                "Invalid timestamp."
                        },
                        400
                    );
                }


                if (
                    timestamp <=
                    Math.floor(
                        Date.now() /
                        1000
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
                        new Date()
                            .toISOString()
                });
            }


            // ======================================
            // EDIT
            // ======================================

            else if (
                action ===
                "edit"
            ) {

                const item =
                    data.homework.find(
                        homework =>
                            homework.id ===
                            body.id
                    );


                if (
                    !item
                ) {

                    return json(
                        {
                            error:
                                "Homework not found."
                        },
                        404
                    );
                }


                const title =
                    body.title?.trim();


                const note =
                    body.note?.trim() ||
                    "";


                const timestamp =
                    Number(
                        body.timestamp
                    );


                if (
                    !title
                ) {

                    return json(
                        {
                            error:
                                "Title is required."
                        },
                        400
                    );
                }


                if (
                    !Number.isFinite(
                        timestamp
                    )
                ) {

                    return json(
                        {
                            error:
                                "Invalid timestamp."
                        },
                        400
                    );
                }


                if (
                    timestamp <=
                    Math.floor(
                        Date.now() /
                        1000
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


                item.title =
                    title;


                item.note =
                    note;


                item.timestamp =
                    timestamp;


                item.updatedAt =
                    new Date()
                        .toISOString();
            }


            // ======================================
            // DELETE
            // ======================================

            else if (
                action ===
                "delete"
            ) {

                const before =
                    data.homework.length;


                data.homework =
                    data.homework.filter(
                        item =>
                            item.id !==
                            body.id
                    );


                if (
                    data.homework.length ===
                    before
                ) {

                    return json(
                        {
                            error:
                                "Homework not found."
                        },
                        404
                    );
                }
            }


            else {

                return json(
                    {
                        error:
                            "Invalid action."
                    },
                    400
                );
            }


            // ======================================
            // Sort
            // ======================================

            sortHomework(
                data.homework
            );


            // ======================================
            // Update Discord
            // ======================================

            await syncDiscord(
                data
            );


            // ======================================
            // Save JSON
            // ======================================

            await saveData(
                store,
                data
            );


            return json({

                success:
                    true,

                homework:
                    data.homework
            });
        }


        return json(
            {
                error:
                    "Method not allowed."
            },
            405
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