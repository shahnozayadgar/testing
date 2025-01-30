// Automatically fetch the summary when the page loads
document.addEventListener("DOMContentLoaded", async () => {
  const summaryContainer = document.getElementById("summary-container");
  const saveButton = document.getElementById("save-summary");
  const generateStoriesButton = document.getElementById("generate-stories");
  const allSummariesContainer = document.getElementById("all-summary");
  let globalSummaries = null;
  let globalCharacteristics = null;
  let globalDifferences = null;
  const stored = localStorage.getItem("globalSummaries");
  if (stored) {
    globalSummaries = JSON.parse(stored);
  }
  
  try {
    const response = await fetch("http://localhost:3000/pdf/summary/one");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    console.log(data.summary);

    summaryContainer.innerHTML = `
            <h3>Summary for Little Match Girl:</h3>
            <div contenteditable="true" class="editable-summary" id="editable-summary">${data.summary}</div>
        `;
  } catch (error) {
    summaryContainer.innerHTML = `<p>Error fetching summary: ${error.message}</p>`;
  }

  //capturing the dited summary and sending it to the server
  saveButton.addEventListener("click", async () => {
    const editableDiv = document.getElementById("editable-summary");
    if (!editableDiv) {
      alert("Please edit the summary before saving.");
      return;
    }
    const userEditedSummary = editableDiv.innerText.trim();
    if (!userEditedSummary) {
      alert("Please write your preferred summary before saving.");
      return;
    }

    try {
      //posting the user edited summary to the server
      const saveResponse = await fetch(
        "http://localhost:3000/pdf/summary/save",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ summary: userEditedSummary }),
        }
      );
      if (!saveResponse.ok) {
        throw new Error("Failed to save summary");
      }

      const saveResult = await saveResponse.json();
      alert(saveResult.message);

      const comparisonResponse = await fetch(
        "http://localhost:3000/pdf/summary/analysis",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userSummary: userEditedSummary }),
        }
      );

      if (!comparisonResponse.ok) {
        const errorData = await comparisonResponse.json();
        throw new Error(errorData.error || "Comparison failed");
      }

      const comparisonResult = await comparisonResponse.json();
      //alert(comparisonResult.message);
      // Store the comparison result properly
      globalSummaries = {
        summary1: comparisonResult.originalSummary,
        summary2: comparisonResult.editedSummary,
      };
      localStorage.setItem("globalSummaries", JSON.stringify(globalSummaries));
      globalCharacteristics = {
        characteristics1: comparisonResult.characteristics1,
        characteristics2: comparisonResult.characteristics2,
      };
      globalDifferences = {
        differences1: comparisonResult.differences1,
        differences2: comparisonResult.differences2,
      };

      console.log("Comparison successful:", comparisonResult);
    } catch (error) {
      alert("error while saving summary" + error.message);
    }
  });

  //Add event listener for the generate button
  // generateStoriesButton.addEventListener('click', async () => {
  //     try {
  //         const allSummariesResponse = await fetch('http://localhost:3000/pdf/summary/all', {
  //             method: 'POST',
  //             headers: {
  //                 'Content-Type': 'application/json',
  //             },
  //         });

  //         if (!allSummariesResponse.ok) {
  //             throw new Error('Failed to fetch all summaries');
  //         }

  //         const allSummariesData = await allSummariesResponse.json();
  //         console.log(allSummariesData.summaries);

  //         // Display all summaries in the allSummariesContainer
  //         allSummariesContainer.innerHTML = allSummariesData.summaries.map(summary => `
  //             <div>
  //                 <h4>${summary.file}</h4>
  //                 <p>${summary.summary || summary.error}</p>
  //             </div>
  //         `).join('');
  //     } catch (error) {
  //         allSummariesContainer.innerHTML = `<p>Error fetching all summaries: ${error.message}</p>`;
  //     }
  // });
  generateStoriesButton.addEventListener("click", async () => {
    if (!globalSummaries || !globalSummaries.summary1 || !globalSummaries.summary2) {
        alert("Please save a summary first!");
        return;
      }
    try {
      const allSummariesResponse = await fetch(
        "http://localhost:3000/pdf/summary/all",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            originalSummary: globalSummaries.summary1,
            editedSummary: globalSummaries.summary2,
          }),
        }
      );

      if (!allSummariesResponse.ok) {
        throw new Error("Failed to fetch all summaries");
      }

      const allSummariesData = await allSummariesResponse.json();
      console.log("Raw response:", allSummariesData);

      // Process and display the summaries
      allSummariesContainer.innerHTML = allSummariesData.summaries
        .map((summary) => {
          // Handle error cases first
          if (summary.error) {
            return `
                        <div class="summary-error">
                            <h4>${path.basename(summary.file)}</h4>
                            <p>Error: ${summary.error}</p>
                        </div>
                    `;
          }

          // Handle successful parsed summaries
          if (summary.bookName && summary.summaries) {
            return `
                        <div class="summary-item">
                            <h3>${summary.bookName}</h3>
                            <div class="summary-pair">
                                <div class="summary-version">
                                    <h4>Version 1 (${
                                      summary.summaries.characteristics1 ||
                                      "Default Style"
                                    })</h4>
                                    <p>${summary.summaries.summary1}</p>
                                </div>
                                <div class="summary-version">
                                    <h4>Version 2 (${
                                      summary.summaries.characteristics2 ||
                                      "Alternative Style"
                                    })</h4>
                                    <p>${summary.summaries.summary2}</p>
                                </div>
                            </div>
                            ${
                              summary.differences
                                ? `
                            <div class="differences">
                                <h4>Key Differences:</h4>
                                <ul>
                                    ${Object.values(summary.differences)
                                      .map((diff) => `<li>${diff}</li>`)
                                      .join("")}
                                </ul>
                            </div>
                            `
                                : ""
                            }
                        </div>
                    `;
          }

          // Fallback for unexpected format
          return `
                    <div class="summary-error">
                        <h4>${path.basename(summary.file)}</h4>
                        <p>Unexpected response format</p>
                        <pre>${JSON.stringify(summary, null, 2)}</pre>
                    </div>
                `;
        })
        .join("");
    } catch (error) {
      allSummariesContainer.innerHTML = `
                <div class="error">
                    <p>Error fetching all summaries: ${error.message}</p>
                </div>
            `;
    }
  });
});
