import PDFParser from 'pdf2json';
import 'dotenv/config';
import path from 'path';
import OpenAI from 'openai';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';   

//start the server
const app = express();
app.use(cors());
app.use(express.json());
const port = 3000;
const upload = multer({ dest: 'uploads/' });

//start assistant
const openai = new OpenAI.OpenAI();
const assistantName = 'PDFSummarizer';
let assistant;

async function initializeAssistant() {
  assistant = await getAssistant('PDFSummarizer', 'gpt-4o-mini', 'Summarize PDFs');
}

//getting the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//backend enpoints

//endpoint to summarize pdf
app.post('/pdf/summary', upload.single('pdfFile'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }
    
    const pdfFilePath = req.file.path;
    const pdfParserInstance = new PDFParser();
    
    pdfParserInstance.on('pdfParser_dataError', (errData) => {
      cleanupUploadedFile(pdfFilePath);
      res.status(500).json({
        error: 'An error occurred while parsing the PDF: ' + errData.parserError,
      });
    });
    
    pdfParserInstance.on('pdfParser_dataReady', (pdfData) => {
      const pdfText = extractTextFromPDFData(pdfData);
      
      const instructions = `
        Using the following text extracted from a PDF file, write a concise summary (max 200 words):
        ${pdfText}
      `;
      
      createThread()
        .then((thread) => {
          const thread_id = thread.id;
          invokeAssistant(assistant, thread_id, 'Summarize PDF file', instructions)
            .then((response) => {
              cleanupUploadedFile(pdfFilePath);
              res.json({ summary: response });
            })
            .catch((error) => {
              cleanupUploadedFile(pdfFilePath);
              res.status(500).json({
                error:
                  'An error occurred while summarizing the PDF: ' +
                  (error.response ? error.response.data : error.message),
              });
            });
        })
        .catch((error) => {
          cleanupUploadedFile(pdfFilePath);
          res.status(500).json({ error: 'Failed to create thread: ' + error });
        });
    });
    
    pdfParserInstance.loadPDF(pdfFilePath);
  });

  //endpoint to summarize example.pdf from assets folder
  app.get('/pdf/summary/example', (req, res) => {
    const pdfFilePath = path.join(__dirname, 'assets', 'example.pdf');
    const pdfParserInstance = new PDFParser();
  
    pdfParserInstance.on('pdfParser_dataError', (errData) => {
      res.status(500).json({
        error: 'An error occurred while parsing the PDF: ' + errData.parserError,
      });
    });
  
    pdfParserInstance.on('pdfParser_dataReady', (pdfData) => {
      const pdfText = extractTextFromPDFData(pdfData);
  
      const instructions = `
        Using the following text extracted from a PDF file, write a concise summary (max 200 words):
        ${pdfText}
      `;
  
      createThread()
        .then((thread) => {
          const thread_id = thread.id;
          invokeAssistant(assistant, thread_id, 'Summarize PDF file', instructions)
            .then((response) => {
              res.json({ summary: response });
            })
            .catch((error) => {
              res.status(500).json({
                error:
                  'An error occurred while summarizing the PDF: ' +
                  (error.response ? error.response.data : error.message),
              });
            });
        })
        .catch((error) => {
          res.status(500).json({ error: 'Failed to create thread: ' + error });
        });
    });
  
    pdfParserInstance.loadPDF(pdfFilePath);
  });  

  initializeAssistant().then(() => {
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  });

function extractTextFromPDFData(pdfData) {
    let pdfText = '';
  
    if (pdfData && pdfData.Pages) {
      pdfData.Pages.forEach((page) => {
        page.Texts.forEach((text) => {
          text.R.forEach((run) => {
            const decodedText = decodeURIComponent(run.T);
            pdfText += decodedText + ' ';
          });
          pdfText += '\n';
        });
        pdfText += '\n';
      });
    }
  
    return pdfText.trim(); //returned as combined string
  }

  //helper functions 
  
  async function getAssistant(name, model = 'gpt-4o-mini', instructions = 'A simple assistant') {
    const response = await openai.beta.assistants.list({ limit: 100 });
    console.log('Assistant list response:', response);
    // Use the array inside response.body.data
    const assistants = response.body.data;
    const foundAssistant = assistants.find((assistant) => assistant.name === name);
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
    instructions = 'A simple assistant',
    model = 'gpt-4o-mini',
    temperature = 0.3
  ) {
    return addMessageToThread(thread_id, { role: 'user', content: prompt })
      .then(() => {
        return openai.beta.threads.runs.createAndPoll(thread_id, {
          assistant_id: assistant.id,
          instructions: instructions,
          model,
          temperature
        });
      })
      .then((run) => {
        if (run.status === 'completed') {
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
