import PDFParser from "pdf2json";
import "dotenv/config";
import path from "path";
import OpenAI from "openai";
import express from "express";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";

//start the server
const app = express();
app.use(cors());
app.use(express.json());
const port = 3000;

//start assistant
const openai = new OpenAI.OpenAI();
const assistantName = "PDFSummarizer";
let assistant;

async function initializeAssistant() {
  assistant = await getAssistant(
    "PDFSummarizer",
    "gpt-4o-mini",
    "Summarize PDFs"
  );
}

//getting the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//setting gloabl reusable variables
let globalSummaries = null;
let globalCharacteristics = null;
let globalDifferences = null;

//global variables
let lastGeneratedSummary = null;

//backend enpoints

//endpoint to summarize example.pdf from assets folder
// app.get("/pdf/summary/feedback", (req, res) => {
//   const pdfFilePath = path.join(__dirname, "assets", "snow-man.pdf");
//   const pdfParserInstance = new PDFParser();

//   pdfParserInstance.on("pdfParser_dataError", (errData) => {
//     res.status(500).json({
//       error: "An error occurred while parsing the PDF: " + errData.parserError,
//     });
//   });

//   pdfParserInstance.on("pdfParser_dataReady", (pdfData) => {
//     const pdfText = extractTextFromPDFData(pdfData);

//     const instructions = `
//         Using the following text extracted from a PDF file of children story by Hans Christian Andersen, write two concise summaries (max 100 words each):
//         ${pdfText}

//         Return in following format:
//         "1. Summary 1:"
//         "2. Summary 2:"

//         Analyse both summaries and return in following format:
//         "1. Characteristics 1:" What are the characteristics of the Summary 1?
//         "2. Characteristics 2:" What are the characteristics of the Summary 2?
//         "3. Differences 1:" What differentiates Summary 1 from Summary 2?
//         "4. Differences 2:" What differentiates Summary 2 from Summary 1?
//       `;

//     createThread()
//       .then((thread) => {
//         const thread_id = thread.id;
//         invokeAssistant(
//           assistant,
//           thread_id,
//           "Summarize PDF file",
//           instructions
//         )
//           .then((response) => {
//             //console.log("response", response);
//             const match = response.match(
//               /1\. Summary 1:\s*(.*?)\s*2\. Summary 2:\s*(.*?)\s*1\. Characteristics 1:\s*(.*?)\s*2\. Characteristics 2:\s*(.*?)\s*3\. Differences 1:\s*(.*?)\s*4\. Differences 2:\s*(.*)/s
//             );
//             if (match){
//               const summary1 = match[1].trim();
//               const summary2 = match[2].trim();
//               const characteristics1 = match[3].trim();
//               const characteristics2 = match[4].trim();
//               const differences1 = match[5].trim();
//               const differences2 = match[6].trim();

//               //storing the extracted values in global variables
//               globalSummaries = {summary1, summary2};
//               globalCharacteristics = {characteristics1, characteristics2};
//               globalDifferences = {differences1, differences2};

//               console.log("summary 1", summary1);
//               console.log("summary 2", summary2);
//               console.log("characteristics 1", characteristics1);
//               console.log("characteristics 2", characteristics2);
//               console.log("differences 1", differences1);
//               console.log("differences 2", differences2);

//               res.json({ summary1, summary2, characteristics1, characteristics2, differences1, differences2 });
//             }
//           })
//           .catch((error) => {
//             res.status(500).json({
//               error:
//                 "An error occurred while summarizing the PDF: " +
//                 (error.response ? error.response.data : error.message),
//             });
//           });
//       })
//       .catch((error) => {
//         res.status(500).json({ error: "Failed to create thread: " + error });
//       });
//   });

//   pdfParserInstance.loadPDF(pdfFilePath);
// });

app.get("/pdf/summary/one", (req, res) => {
  const pdfFilePath = path.join(__dirname, "assets", "little-match-girl.pdf");
  const pdfParserInstance = new PDFParser();

  pdfParserInstance.on("pdfParser_dataError", (errData) => {
    res.status(500).json({
      error: "An error occurred while parsing the PDF: " + errData.parserError,
    });
  });

  pdfParserInstance.on("pdfParser_dataReady", (pdfData) => {
    const pdfText = extractTextFromPDFData(pdfData);

    const instructions = `
        Using the following text extracted from a PDF file of children story by Hans Christian Andersen, write a concise summary (within 150 words):
        ${pdfText}
      `;

    createThread()
      .then((thread) => {
        const thread_id = thread.id;
        invokeAssistant(
          assistant,
          thread_id,
          "Summarize PDF file",
          instructions
        )
          .then((response) => {
            console.log("response", response);
            lastGeneratedSummary = response;
            res.json({ summary: response });
          })
          .catch((error) => {
            res.status(500).json({
              error:
                "An error occurred while summarizing the PDF: " +
                (error.response ? error.response.data : error.message),
            });
          });
      })
      .catch((error) => {
        res.status(500).json({ error: "Failed to create thread: " + error });
      });
  });

  pdfParserInstance.loadPDF(pdfFilePath);
});

//endpoint to save the user's preferred summary
app.post("/pdf/summary/save", (req, res) => {
  const { summary } = req.body;
  if (!summary) {
    return res.status(400).json({ error: "summary is required" });
  }
  //console.log("user's preferred summary:", summary);

  res.json({ message: "summary saved successfully" });
});

app.post("/pdf/summary/analysis", (req, res) => {
  const { userSummary } = req.body;
  //console.log("user's preferred summary:", userSummary)
  //console.log("generated summary", lastGeneratedSummary)

  if (!userSummary || !lastGeneratedSummary) {
    return res
      .status(400)
      .json({ error: "both summaries are required for the analysis" });
  }

  const instructions = `
  You are an advanced text summarization assistant. 

  Consider two summaries and return in following format:
  "1. Summary 1:" ${lastGeneratedSummary}
  "2. Summary 2:" ${userSummary}
  "1. Characteristics 1:" What are the characteristics of the Summary 1?
  "2. Characteristics 2:" What are the characteristics of the Summary 2?
  "3. Differences 1:" What differentiates Summary 1 from Summary 2?
  "4. Differences 2:" What differentiates Summary 2 from Summary 1?
  `;
  createThread()
    .then((thread) => {
      const thread_id = thread.id;
      invokeAssistant(assistant, thread_id, "Compare summaries", instructions)
        .then((comparisonResponse) => {
          //console.log("comparison", comparisonResponse)
          const match = comparisonResponse.match(
            /1\. Summary 1:\s*(.*?)\s*2\. Summary 2:\s*(.*?)\s*1\. Characteristics 1:\s*(.*?)\s*2\. Characteristics 2:\s*(.*?)\s*3\. Differences 1:\s*(.*?)\s*4\. Differences 2:\s*(.*)/s
          );
          if (match) {
            const summary1 = match[1].trim();
            const summary2 = match[2].trim();
            const characteristics1 = match[3].trim();
            const characteristics2 = match[4].trim();
            const differences1 = match[5].trim();
            const differences2 = match[6].trim();

            //storing the extracted values in global variables
            globalSummaries = { summary1, summary2 };
            globalCharacteristics = { characteristics1, characteristics2 };
            globalDifferences = { differences1, differences2 };

            console.log("summary 1", summary1);
            console.log("summary 2", summary2);
            console.log("characterisitcs 1", characteristics1);
            console.log("characteristics 2", characteristics2);
            console.log("differences 1", differences1);
            console.log("differences 2", differences2);

            res.json({
              summary1,
              summary2,
              characteristics1,
              characteristics2,
              differences1,
              differences2,
            });
          }
          //console.log("comparison analysis:", comparisonResponse);
          //res.json({ comparison: comparisonResponse});
        })
        .catch((error) => {
          res.status(500).json({
            error:
              "an error happened" +
              (error.response ? error.response.data : error.message),
          });
        });
    })
    .catch((error) => {
      res.status(500).json({ error: "failed to create thread: " + error });
    });
});

// Endpoint to summarize all PDFs in the assets folder
app.post("/pdf/summary/all", (req, res) => {
  const assetsDir = path.join(__dirname, "assets");
  fs.readdir(assetsDir, (err, files) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Failed to read assets directory: " + err });
    }

    const pdfFiles = files.filter((file) => file.endsWith(".pdf"));
    const summaries = [];

    const processNextFile = () => {
      if (pdfFiles.length === 0) {
        return res.json({ summaries });
      }

      const pdfFilePath = path.join(assetsDir, pdfFiles.shift());
      const pdfParserInstance = new PDFParser();

      pdfParserInstance.on("pdfParser_dataError", (errData) => {
        summaries.push({
          file: pdfFilePath,
          error: "Failed to parse PDF: " + errData.parserError,
        });
        processNextFile();
      });

      pdfParserInstance.on("pdfParser_dataReady", (pdfData) => {
        const pdfText = extractTextFromPDFData(pdfData);

        const instructions = `
        ANALYSIS CONTEXT:
        - Preferred Summary Style: ${globalCharacteristics.characteristics1}
        - Contrast Style: ${globalCharacteristics.characteristics2}
        - Key Differentiators: 
          1. ${globalDifferences.differences1}
          2. ${globalDifferences.differences2}

        NEW STORY TO SUMMARIZE:
        """
        ${pdfText}
        """

        CREATE 2 SUMMARIES FOLLOWING THESE RULES:
          1. First summary using preferred style
          2. Second summary using contrast style
          3. Max 100 words each

        FORMAT:
          "1. [Book Name] Summary 1: [content]"
          "2. [Book Name] Summary 2: [content]"
`;

        createThread()
          .then((thread) => {
            const thread_id = thread.id;
            invokeAssistant(
              assistant,
              thread_id,
              "Summarize PDF file",
              instructions
            )
              .then((response) => {
                const match = response.match(
                  /1\. (.*?) Summary 1:\s*(.*?)\s*2\. (.*?) Summary 2:\s*(.*)/s
                );
                if (match) {
                  const bookName1 = match[1].trim();
                  const summary1 = match[2].trim();
                  const bookName2 = match[3].trim();
                  const summary2 = match[4].trim();

                  summaries.push({
                    file: pdfFilePath, 
                    bookName: bookName1,
                    summaries:{summary1, summary2}
                  });
                }
                processNextFile();
              })
              .catch((error) => {
                summaries.push({
                  file: pdfFilePath,
                  error:
                    "Failed to summarize PDF: " +
                    (error.response ? error.response.data : error.message),
                });
                processNextFile();
              });
          })
          .catch((error) => {
            summaries.push({
              file: pdfFilePath,
              error: "Failed to create thread: " + error,
            });
            processNextFile();
          });
      });

      pdfParserInstance.loadPDF(pdfFilePath);
    };

    processNextFile();
  });
});

initializeAssistant().then(() => {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
});

function extractTextFromPDFData(pdfData) {
  let pdfText = "";

  if (pdfData && pdfData.Pages) {
    pdfData.Pages.forEach((page) => {
      page.Texts.forEach((text) => {
        text.R.forEach((run) => {
          const decodedText = decodeURIComponent(run.T);
          pdfText += decodedText + " ";
        });
        pdfText += "\n";
      });
      pdfText += "\n";
    });
  }

  return pdfText.trim(); //returned as combined string
}

//helper functions

async function getAssistant(
  name,
  model = "gpt-4o-mini",
  instructions = "A simple assistant"
) {
  const response = await openai.beta.assistants.list({ limit: 100 });
  //console.log("Assistant list response:", response);
  // Use the array inside response.body.data
  const assistants = response.body.data;
  const foundAssistant = assistants.find(
    (assistant) => assistant.name === name
  );
  if (foundAssistant) return foundAssistant;

  // if no assistant was found, create one
  return openai.beta.assistants.create({
    name,
    model,
    instructions,
  });
}

function createThread() {
  return openai.beta.threads.create();
}

function addMessageToThread(threadId, message) {
  return openai.beta.threads.messages.create(threadId, message);
}

function invokeAssistant(
  assistant,
  thread_id,
  prompt,
  instructions = "A simple assistant",
  model = "gpt-4o-mini",
  temperature = 0.3
) {
  return addMessageToThread(thread_id, { role: "user", content: prompt })
    .then(() => {
      return openai.beta.threads.runs.createAndPoll(thread_id, {
        assistant_id: assistant.id,
        instructions: instructions,
        model,
        temperature,
      });
    })
    .then((run) => {
      if (run.status === "completed") {
        return openai.beta.threads.messages.list(thread_id);
      } else {
        throw new Error("Run didn't complete");
      }
    })
    .then((messages) => {
      const answer = messages.data[0].content[0].text.value;
      return answer;
    });
}
