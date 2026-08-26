exports.handler = async function (event) {

    // Only allow POST
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({
                error: "Method not allowed"
            })
        };
    }

    try {

        const { title, note, timestamp } = JSON.parse(event.body);

        // Validate input
        if (!title || !timestamp) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "Title and date are required"
                })
            };
        }

        // Create Discord embed
        const desc =
            `> Due <t:${timestamp}:F> (<t:${timestamp}:R>)` +
            (note && note.trim() ? `\n> ${note}` : "");

        const embed = {
            title: title,
            description: desc,
            color: 0xFF0000
        };

        // Send to Discord
        const response = await fetch(
            process.env.DISCORD_WEBHOOK_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username: "Homework Reminder",
                    embeds: [embed]
                })
            }
        );

        if (!response.ok) {

            const errorText = await response.text();

            console.error("Discord error:", errorText);

            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: "Discord webhook failed"
                })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true
            })
        };

    } catch (error) {

        console.error("Function error:", error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Internal server error"
            })
        };
    }
};