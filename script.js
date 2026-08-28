const form =
    document.getElementById("homeworkForm");

const titleInput =
    document.getElementById("title");

const noteInput =
    document.getElementById("note");

const datetimeInput =
    document.getElementById("dt");

const editIdInput =
    document.getElementById("editId");

const submitButton =
    document.getElementById("submitButton");

const cancelButton =
    document.getElementById("cancelButton");

const refreshButton =
    document.getElementById("refreshButton");

const homeworkList =
    document.getElementById("homeworkList");

const statusElement =
    document.getElementById("status");


// --------------------------------------------------
// Minimum date
// --------------------------------------------------

function updateMinimumDate() {

    const now = new Date();

    const localDateTime =
        new Date(
            now.getTime() -
            now.getTimezoneOffset() * 60000
        )
            .toISOString()
            .slice(0, 16);

    datetimeInput.min =
        localDateTime;
}

updateMinimumDate();


// --------------------------------------------------
// Convert Unix timestamp to datetime-local value
// --------------------------------------------------

function timestampToInput(timestamp) {

    const date =
        new Date(timestamp * 1000);

    const localDate =
        new Date(
            date.getTime() -
            date.getTimezoneOffset() * 60000
        );

    return localDate
        .toISOString()
        .slice(0, 16);
}


// --------------------------------------------------
// Format date for website
// --------------------------------------------------

function formatDate(timestamp) {

    return new Date(timestamp * 1000)
        .toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );
}


// --------------------------------------------------
// Check if homework is overdue
// --------------------------------------------------

function isOverdue(timestamp) {

    return Number(timestamp) <=
        Math.floor(Date.now() / 1000);
}


// --------------------------------------------------
// Load homework
// --------------------------------------------------

async function loadHomework() {

    homeworkList.innerHTML =
        `<p class="empty">Loading...</p>`;

    try {

        const response =
            await fetch(
                "/.netlify/functions/discord",
                {
                    method: "GET"
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


    } catch (error) {

        console.error(
            "Load error:",
            error
        );


        homeworkList.innerHTML =
            `<p class="empty">
                ${error.message}
            </p>`;
    }
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
            `<p class="empty">
                No homework yet.
            </p>`;

        return;
    }


    homeworkList.innerHTML = "";


    homework.forEach(item => {

        const overdue =
            isOverdue(item.timestamp);


        const element =
            document.createElement("div");


        element.className =
            overdue
                ? "homework-item overdue"
                : "homework-item upcoming";


        // ------------------------------------------
        // Title
        // ------------------------------------------

        const title =
            document.createElement("div");


        title.className =
            "homework-title";


        title.textContent =
            `${overdue ? "⚠️ " : ""}${item.title}`;


        // ------------------------------------------
        // Date
        // ------------------------------------------

        const date =
            document.createElement("div");


        date.className =
            "homework-date";


        if (overdue) {

            date.innerHTML =
                `<span class="overdue-label">
                    Overdue
                </span>
                · ${formatDate(item.timestamp)}`;

        } else {

            date.textContent =
                `Due: ${formatDate(item.timestamp)}`;
        }


        // ------------------------------------------
        // Note
        // ------------------------------------------

        const note =
            document.createElement("div");


        note.className =
            "homework-note";


        note.textContent =
            item.note ||
            "No note";


        // ------------------------------------------
        // Buttons
        // ------------------------------------------

        const actions =
            document.createElement("div");


        actions.className =
            "homework-actions";


        const editButton =
            document.createElement("button");


        editButton.type =
            "button";


        editButton.textContent =
            "Edit";


        editButton.onclick =
            () => startEdit(item);


        const deleteButton =
            document.createElement("button");


        deleteButton.type =
            "button";


        deleteButton.textContent =
            "Delete";


        deleteButton.className =
            "delete";


        deleteButton.onclick =
            () => deleteHomework(item.id);


        actions.appendChild(
            editButton
        );


        actions.appendChild(
            deleteButton
        );


        element.appendChild(title);

        element.appendChild(date);

        element.appendChild(note);

        element.appendChild(actions);


        homeworkList.appendChild(
            element
        );
    });
}


// --------------------------------------------------
// Add / Edit
// --------------------------------------------------

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const title =
            titleInput.value.trim();


        const note =
            noteInput.value.trim();


        const dateInput =
            datetimeInput.value;


        const editId =
            editIdInput.value;


        if (
            !title ||
            !dateInput
        ) {

            return;
        }


        const selectedDate =
            new Date(dateInput);


        if (
            isNaN(
                selectedDate.getTime()
            )
        ) {

            alert(
                "Invalid date."
            );

            return;
        }


        const timestamp =
            Math.floor(
                selectedDate.getTime() /
                1000
            );


        if (
            timestamp <=
            Math.floor(
                Date.now() / 1000
            )
        ) {

            alert(
                "Please select a future date and time."
            );

            return;
        }


        const action =
            editId
                ? "edit"
                : "add";


        setLoading(true);


        statusElement.textContent =
            editId
                ? "Updating..."
                : "Posting...";


        try {

            const response =
                await fetch(
                    "/.netlify/functions/discord",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            action:

                                action,

                            id:

                                editId ||
                                undefined,

                            title:

                                title,

                            note:

                                note,

                            timestamp:

                                timestamp
                        })
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
                    "Operation failed."
                );
            }


            statusElement.textContent =
                editId
                    ? "Homework updated!"
                    : "Homework posted!";


            resetForm();


            renderHomework(
                data.homework
            );


        } catch (error) {

            console.error(
                "Submit error:",
                error
            );


            statusElement.textContent =
                "Operation failed.";


            alert(
                error.message
            );

        } finally {

            setLoading(false);
        }
    }
);


// --------------------------------------------------
// Start editing
// --------------------------------------------------

function startEdit(item) {

    editIdInput.value =
        item.id;


    titleInput.value =
        item.title;


    noteInput.value =
        item.note || "";


    datetimeInput.value =
        timestampToInput(
            item.timestamp
        );


    submitButton.textContent =
        "Save Changes";


    cancelButton.hidden =
        false;


    updateMinimumDate();


    window.scrollTo({

        top: 0,

        behavior: "smooth"
    });
}


// --------------------------------------------------
// Cancel edit
// --------------------------------------------------

cancelButton.addEventListener(
    "click",
    resetForm
);


function resetForm() {

    form.reset();


    editIdInput.value =
        "";


    submitButton.textContent =
        "Post Homework";


    cancelButton.hidden =
        true;


    updateMinimumDate();
}


// --------------------------------------------------
// Delete
// --------------------------------------------------

async function deleteHomework(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this homework?"
        );


    if (!confirmed) {
        return;
    }


    setLoading(true);


    statusElement.textContent =
        "Deleting...";


    try {

        const response =
            await fetch(
                "/.netlify/functions/discord",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        action:
                            "delete",

                        id:
                            id
                    })
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
                "Failed to delete homework."
            );
        }


        statusElement.textContent =
            "Homework deleted!";


        renderHomework(
            data.homework
        );


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );


        statusElement.textContent =
            "Delete failed.";


        alert(
            error.message
        );

    } finally {

        setLoading(false);
    }
}


// --------------------------------------------------
// Refresh
// --------------------------------------------------

refreshButton.addEventListener(
    "click",
    loadHomework
);


// --------------------------------------------------
// Loading state
// --------------------------------------------------

function setLoading(loading) {

    submitButton.disabled =
        loading;

    cancelButton.disabled =
        loading;

    refreshButton.disabled =
        loading;
}


// --------------------------------------------------
// Initial load
// --------------------------------------------------

loadHomework();