const form = document.getElementById("homeworkForm");

const titleInput = document.getElementById("title");
const noteInput = document.getElementById("note");
const datetimeInput = document.getElementById("dt");

const editIdInput = document.getElementById("editId");

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
// Set minimum date/time
// --------------------------------------------------

function updateMinimumDate() {

    const now = new Date();

    const localDateTime = new Date(
        now.getTime() -
        now.getTimezoneOffset() * 60000
    )
        .toISOString()
        .slice(0, 16);

    datetimeInput.min = localDateTime;
}

updateMinimumDate();


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
// Load homework
// --------------------------------------------------

async function loadHomework() {

    homeworkList.innerHTML =
        `<p class="empty">Loading...</p>`;

    try {

        const response = await fetch(
            "/.netlify/functions/discord",
            {
                method: "GET"
            }
        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to load homework."
            );
        }

        renderHomework(data.homework);

    } catch (error) {

        console.error(error);

        homeworkList.innerHTML =
            `<p class="empty">
                Failed to load homework.
            </p>`;
    }
}


// --------------------------------------------------
// Render homework list
// --------------------------------------------------

function renderHomework(homework) {

    if (!homework || homework.length === 0) {

        homeworkList.innerHTML =
            `<p class="empty">
                No homework yet.
            </p>`;

        return;
    }


    homeworkList.innerHTML = "";


    homework.forEach(item => {

        const element =
            document.createElement("div");

        element.className = "homework-item";


        const title =
            document.createElement("div");

        title.className = "homework-title";

        title.textContent = item.title;


        const date =
            document.createElement("div");

        date.className = "homework-date";

        date.textContent =
            `Due: ${formatDate(item.timestamp)}`;


        const note =
            document.createElement("div");

        note.className = "homework-note";

        note.textContent =
            item.note || "No note";


        const actions =
            document.createElement("div");

        actions.className =
            "homework-actions";


        const editButton =
            document.createElement("button");

        editButton.type = "button";

        editButton.textContent = "Edit";

        editButton.onclick = () => {

            startEdit(item);
        };


        const deleteButton =
            document.createElement("button");

        deleteButton.type = "button";

        deleteButton.textContent = "Delete";

        deleteButton.className = "delete";

        deleteButton.onclick = () => {

            deleteHomework(item.id);
        };


        actions.appendChild(editButton);

        actions.appendChild(deleteButton);


        element.appendChild(title);

        element.appendChild(date);

        element.appendChild(note);

        element.appendChild(actions);


        homeworkList.appendChild(element);
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

        if (!title || !dateInput) {

            return;
        }


        const timestamp =
            Math.floor(
                new Date(dateInput).getTime() / 1000
            );


        if (
            !Number.isFinite(timestamp) ||
            timestamp <= Math.floor(Date.now() / 1000)
        ) {

            alert(
                "Please select a future date and time."
            );

            return;
        }


        const editId =
            editIdInput.value;


        const action =
            editId
                ? "edit"
                : "add";


        setLoading(true);


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

                            action: action,

                            id: editId || undefined,

                            title: title,

                            note: note,

                            timestamp:
                                timestamp
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Operation failed."
                );
            }


            statusElement.textContent =
                editId
                    ? "Homework updated!"
                    : "Homework added!";


            resetForm();

            await loadHomework();


        } catch (error) {

            console.error(error);

            alert(error.message);

            statusElement.textContent =
                "Operation failed.";

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


    const date =
        new Date(
            item.timestamp * 1000
        );


    const local =
        new Date(
            date.getTime() -
            date.getTimezoneOffset() * 60000
        )
            .toISOString()
            .slice(0, 16);


    datetimeInput.value =
        local;


    submitButton.textContent =
        "Save Changes";


    cancelButton.hidden =
        false;


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

    editIdInput.value = "";

    submitButton.textContent =
        "Post Homework";

    cancelButton.hidden = true;

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

                        action: "delete",

                        id: id
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to delete homework."
            );
        }


        statusElement.textContent =
            "Homework deleted!";


        await loadHomework();


    } catch (error) {

        console.error(error);

        alert(error.message);


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