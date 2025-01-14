// Endpoint api
import 'dotenv/config';
import axios from 'axios';
import readline from 'readline'
import OpenAI from 'openai';
const url = 'https://api.openai.com/v1/chat/completions';

const openai = new OpenAI();

// const res = await axios({
//   method: 'post',
//   url,
//   headers: {
//     'Content-Type': 'application/json',
//     Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//   },
//   data: {
//     model: 'gpt-4o-mini',
//     max_tokens: 20,
//     temperature: 0,
//     //prompt: 'Tell me a joke',
//     messages: [
//       {
//         role: 'user',
//         content: 'Telle me a joke',
//       },
//     ],
//   },
// });
// console.log(1, res.data.choices[0].message.content);

// // Node api
// import OpenAI from 'openai';

// const openai = new OpenAI();

// const completion = await openai.chat.completions.create({
//   messages: [{ role: 'user', content: 'Tell me a joke' }],
//   model: 'gpt-4o-mini',
//   temperature: 0.5,
//   max_tokens: 150,
// });

// console.log(2, completion.choices[0].message.content);

//writing a prompt function that takes a userPrompt string as input and an object with options, and return a string result as output or throws error if max token limit is reached

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// }); 
// async function prompt(userPrompt, options) {
//   const {temperature, model, max_tokens} = options;

//   try {
//     //making the api call to openai with the provided prompt and options 
//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [{role: 'user', content: userPrompt}],
//       max_tokens: 20
//     });

//     //getting the response text and the why it finish reason

//     const response = completion.choices[0].message.content;
//     const finishReason = completion.choices[0].finish_reason;

//     //checking if the finish reason is max_token limit
//     if (finishReason !== 'stop') {
//       throw new Error ('Error: max token limit reached')
//     }
//     return response;
//   } catch (error) {
//     console.error('error occured', error.message);
//     throw error;
//   }
// }

// rl.question("Please enter your prompt: ", async (userPrompt) => {
//   try {
//     const options = {
//       temperature: 0.7,
//       model: "gpt-3.5-turbo",
//       max_tokens: 50,
//     };
//     // Call the prompt function with the user's input
//     const result = await prompt(userPrompt, options);
//     console.log("Result:", result);
//   } catch (error) {
//     console.error("Failed to get prompt response:", error.message);
//   } finally {
//     rl.close(); // Close the readline interface
//   }
// });

(async () => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { "role": "system", "content": "You are a helpful assistant that explains modern concepts to ancient people in their language and context"},
        {"role": "user", "content": "Can you explain electricity to someone from ancient Rome? The explanation should be simple, using metaphors from their time, and it should be in Latin"}
      ],
      model: "gpt-3.5-turbo",
      max_tokens: 200,
      temperature: 0.7
    });
    console.log('Explanation of Electricity for an Ancient Roman: ', completion.choices[0].message.content);
  } catch (err) {
    console.error('Failed to get prompt response', err.message);
  }
}) ();