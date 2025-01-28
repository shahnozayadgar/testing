// Automatically fetch the summary when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const summaryContainer = document.getElementById('summary-container');
    const saveButton = document.getElementById('save-summary');
    const generateStoriesButton = document.getElementById('generate-stories');
    const allSummariesContainer = document.getElementById('all-summary')

    try {
        const response = await fetch('http://localhost:3000/pdf/summary/one');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        console.log(data.summary)

        summaryContainer.innerHTML = `
            <h3>Summary for Little Match Girl:</h3>
            <div contenteditable="true" class="editable-summary" id="editable-summary">${data.summary}</div>
        `;
    } catch (error) {
        summaryContainer.innerHTML = `<p>Error fetching summary: ${error.message}</p>`;
    }

    //capturing the dited summary and sending it to the server
    saveButton.addEventListener('click', async () => {
        const editableDiv = document.getElementById('editable-summary');
        if(!editableDiv) {
            alert('Please edit the summary before saving.');
            return;
        }
        const userEditedSummary = editableDiv.innerText.trim();
        if (!userEditedSummary) {
            alert('Please write your preferred summary before saving.');
            return;
        }

        try {
            //posting the user edited summary to the server
            const saveResponse = await fetch('http://localhost:3000/pdf/summary/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ summary: userEditedSummary }),
            });
            if (!saveResponse.ok) {
                throw new Error('Failed to save summary');
            }

            const saveResult = await saveResponse.json();
            alert(saveResult.message);

            const comparisonResponse = await fetch('http://localhost:3000/pdf/summary/analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userSummary: userEditedSummary }),
            });

            if (!comparisonResponse.ok) {
                alert('failed to compare summaries');
            }

            const comparisonResult = await comparisonResponse.json();
            //alert(comparisonResult.message);
        } catch (error) {
            alert('error while saving summary' + error.message);
        }
    })

    //Add event listener for the generate button
    generateStoriesButton.addEventListener('click', async () => {
        try {
            const allSummariesResponse = await fetch('http://localhost:3000/pdf/summary/all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!allSummariesResponse.ok) {
                throw new Error('Failed to fetch all summaries');
            }

            const allSummariesData = await allSummariesResponse.json();
            console.log(allSummariesData.summaries);

            // Display all summaries in the allSummariesContainer
            allSummariesContainer.innerHTML = allSummariesData.summaries.map(summary => `
                <div>
                    <h4>${summary.file}</h4>
                    <p>${summary.summary || summary.error}</p>
                </div>
            `).join('');
        } catch (error) {
            allSummariesContainer.innerHTML = `<p>Error fetching all summaries: ${error.message}</p>`;
        }
    });
});