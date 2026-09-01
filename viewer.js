const homeworkList =
    document.getElementById("homeworkList");

const refreshButton =
    document.getElementById("refreshButton");

const statusElement =
    document.getElementById("status");


// --------------------------------------------------
// Check overdue
// --------------------------------------------------

function isOverdue(timestamp) {

    return Number(timestamp) <=
        Math.floor(Date.now() / 1000);
}


// --------------------------------------------------
// Format normal date
// --------------------------------------------------

function formatDate(timestamp) {

    return new Date(
        Number(timestamp) * 1000
    ).toLocaleString(
        undefined,
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
}


// --------------------------------------------------
// Format relative time
// Similar to Discord
// --------------------------------------------------

function formatRelativeTime(timestamp) {

    const now =
        Date.now();

    const target =
        Number(timestamp) * 1000;

    const difference =
        target - now;

    const seconds =
        Math.floor(
            Math.abs(difference) / 1000
        );


    if (seconds < 60) {

        return difference >= 0
            ? "in less than a minute"
            : "less than a minute ago";
    }


    const minutes =
        Math.floor(seconds / 60);


    if (minutes < 60) {

        return difference >= 0
            ? `in ${minutes} minute${minutes === 1 ? "" : "s"}`
            : `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }


    const hours =
        Math.floor(minutes / 60);


    if (hours < 24) {

        return difference >= 0
            ? `in ${hours} hour${hours === 1 ? "" : "s"}`
            : `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }


    const days =
        Math.floor(hours / 24);


    if (days < 30) {

        return difference >= 0
            ? `in ${days} day${days === 1 ? "" : "s"}`
            : `${days} day${days === 1 ? "" : "s"} ago`;
    }


    const months =
        Math.floor(days / 30);


    return difference >= 0
        ? `in ${months} month${months === 1 ? "" : "s"}`
        : `${months} month${months === 1 ? "" : "s"} ago`;
}


// --------------------------------------------------
// Load homework
// --------------------------------------------------

async function loadHomework() {

    refreshButton.disabled = true;

    statusElement.textContent =
        "Loading...";


    try {

        const response =
            await fetch(
                "/.netlify/functions/discord",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch {

            throw new Error(
                `Server returned ${response.status} instead of JSON.`
            );
        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to load homework."
            );
        }


        renderHomework(
            data.homework
        );


        statusElement.textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;


    } catch (error) {

        console.error(
            "Load error:",
            error
        );


        homeworkList.innerHTML =
            `<div class="error">
                Failed to load homework.
                <br><br>
                ${escapeHTML(error.message)}
            </div>`;


        statusElement.textContent =
            "";
    }


    refreshButton.disabled = false;
}


// --------------------------------------------------
// Render homework
// --------------------------------------------------

function renderHomework(homework) {

    if (
        !Array.isArray(homework) ||
        homework.length === 0
    ) {

        homeworkList.innerHTML =
            `<div class="empty">
                🎉 No homework currently!
            </div>`;

        return;
    }


    // Make sure it's sorted by due date
    const sortedHomework =
        [...homework].sort(
            (a, b) =>
                Number(a.timestamp) -
                Number(b.timestamp)
        );


    homeworkList.innerHTML = "";


    sortedHomework.forEach(
        (item, index) => {

            const overdue =
                isOverdue(
                    item.timestamp
                );


            const element =
                document.createElement("article");


            element.className =
                overdue
                    ? "homework-item overdue"
                    : "homework-item";


            // --------------------------------------
            // Title
            // --------------------------------------

            const title =
                document.createElement("div");


            title.className =
                "homework-title";


            title.textContent =
                `${overdue ? "⚠️ " : ""}${index + 1}. ${item.title}`;


            // --------------------------------------
            // Date
            // --------------------------------------

            const date =
                document.createElement("div");


            date.className =
                "homework-date";


            const fullDate =
                formatDate(
                    item.timestamp
                );


            const relativeDate =
                formatRelativeTime(
                    item.timestamp
                );


            if (overdue) {

                date.innerHTML =
                    `<span class="overdue-text">
                        Overdue
                    </span>
                    · ${escapeHTML(fullDate)}
                    (${escapeHTML(relativeDate)})`;

            } else {

                date.textContent =
                    `Due: ${fullDate} (${relativeDate})`;
            }


            // --------------------------------------
            // Note
            // --------------------------------------

            const note =
                document.createElement("div");


            note.className =
                "homework-note";


            if (item.note) {

                note.textContent =
                    item.note;

            } else {

                note.textContent =
                    "No note";

                note.classList.add(
                    "no-note"
                );
            }


            // --------------------------------------
            // Build card
            // --------------------------------------

            element.appendChild(
                title
            );

            element.appendChild(
                date
            );

            element.appendChild(
                note
            );


            homeworkList.appendChild(
                element
            );
        }
    );
}


// --------------------------------------------------
// Escape HTML
// --------------------------------------------------

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// --------------------------------------------------
// Refresh button
// --------------------------------------------------

refreshButton.addEventListener(
    "click",
    loadHomework
);


// --------------------------------------------------
// Initial load
// --------------------------------------------------

loadHomework();


// --------------------------------------------------
// Update relative time every minute
// --------------------------------------------------

setInterval(
    loadHomework,
    60000
);