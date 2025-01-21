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

//backend enpoints

//endpoint to summarize example.pdf from assets folder
app.get("/pdf/summary/example", (req, res) => {
  const pdfFilePath = path.join(__dirname, "assets", "snow-man.pdf");
  const pdfParserInstance = new PDFParser();

  pdfParserInstance.on("pdfParser_dataError", (errData) => {
    res.status(500).json({
      error: "An error occurred while parsing the PDF: " + errData.parserError,
    });
  });

  pdfParserInstance.on("pdfParser_dataReady", (pdfData) => {
    const pdfText = extractTextFromPDFData(pdfData);

    const instructions = `
        Using the following text extracted from a PDF file of children story by Hans Christian Andersen, write two concise summaries (max 200 words each):
        ${pdfText}

        Return in following format:
        "1. Summary 1:"
        "2. Summary 2:"

        Analyse both summaries and return in following format:
        "1. Characteristics 1:" What are the characteristics of the Summary 1?
        "2. Characteristics 2:" What are the characteristics of the Summary 2?
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
            //console.log("response", response);
            const match = response.match(
              /1\. Summary 1:\s*(.*?)\s*2\. Summary 2:\s*(.*?)\s*1\. Characteristics 1:\s*(.*?)\s*2\. Characteristics 2:\s*(.*)/s
            );
            if (match){
              const summary1 = match[1].trim();
              const summary2 = match[2].trim();
              const characteristics1 = match[3].trim();
              const characteristics2 = match[4].trim();

              console.log("summary 1", summary1);
              console.log("summary 2", summary2);
              console.log("characteristics 1", characteristics1);
              console.log("characteristics 2", characteristics2);

              res.json({ summary1, summary2, characteristics1, characteristics2 });
            }
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

// Endpoint to summarize all PDFs in the assets folder
app.get("/pdf/summary/all", (req, res) => {
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
          Using the following text extracted from a PDF file, write a concise summary (max 200 words):
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
                summaries.push({ file: pdfFilePath, summary: response });
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
