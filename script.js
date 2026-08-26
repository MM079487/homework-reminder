async function sendWebhook(event) {

    event.preventDefault();

    const titleInput = document.getElementById("title").value;
    const note = document.getElementById("note").value;
    const dateInput = document.getElementById("dt").value;

    const selectedDate = new Date(dateInput);
    const unixTimestamp = Math.floor(selectedDate.getTime() / 1000);

    try {

        const response = await fetch("/.netlify/functions/discord", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                title: titleInput,
                note: note,
                timestamp: unixTimestamp
            })
        });

        const result = await response.json();

        if (response.ok) {

            alert("Message sent!");

            document.querySelector("form").reset();

        } else {

            console.error(result);

            alert("Failed to send message.");
        }

    } catch (error) {

        console.error("Error:", error);

        alert("Failed to connect to server.");
    }
}


// Prevent selecting a date/time before now

const datetimeInput = document.getElementById("dt");

const now = new Date();

const localDateTime = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
).toISOString().slice(0, 16);

datetimeInput.min = localDateTime;