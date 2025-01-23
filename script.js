// Automatically fetch the summary when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const summariesDiv = document.getElementById('summaries');
    const userSummaryTextarea = document.querySelector('textarea');
    summariesDiv.innerHTML = ''; // Clear previous summaries

    try {
        const response = await fetch('http://localhost:3000/pdf/summary/one');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        console.log(data.summary)

        summariesDiv.innerHTML = `
            <h3>Summary for Little Match Girl:</h3>
            <p>${data.summary}</p>
        `;
    } catch (error) {
        summariesDiv.innerHTML = `<p>Error fetching summary: ${error.message}</p>`;
    }

    //adding event handler for the save summary button
    document.querySelector('button').addEventListener('click', async () => {
        const userSummary = userSummaryTextarea.value;
        if (userSummary) {
            try {
                const response = await fetch('http://localhost:3000/pdf/summary/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ summary: userSummary }),
                });
                if (!response.ok) {
                    throw new Error('Failed to save summary');
                }
                const result = await response.json();
                alert(result.message);

                //comparing the messages
                const comparisonResponse = await fetch('http://localhost:3000/pdf/summary/analysis', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userSummary }),
                });
                if (!comparisonResponse.ok) {
                    throw new Error('Failed to compare summaries');
                }
                const comparisonResult = await comparisonResponse.json();
                //alert('Comparison Result: ' + comparisonResult.comparison);
            } catch (error) {
                alert('Error saving summary: ' + error.message);
            }
        } else {
            alert('Please write your preferred summary before saving.');
        }
    });
});