let router = require("express").Router();
let { OkResponse, BadRequestResponse } = require("express-http-response");
const {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} = require("langchain/prompts");
const { Pinecone } = require("@pinecone-database/pinecone");
const { LLMChain } = require("langchain/chains");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { PineconeStore } = require("langchain/vectorstores/pinecone");

const User = require("../../models/User");
const auth = require("../auth");
const Session = require("../../models/Session");
const UserSubscription = require("../../models/UserSubscription");

const Chat = require("../../models/Chat");

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  // environment: process.env.PINECONE_ENVIRONMENT,
});

const model_name = "gpt-3.5-turbo";
const default_temperature = 0.5;
const model = new ChatOpenAI({
  modelName: model_name,
  default_temperature: default_temperature,
});

// Helper function to determine relevant specialties using OpenAI
const determineRelevantSpecialties = async (patientProblem, doctors) => {
  // Step 1: Create the prompt to send to OpenAI
  const specialtiesList = doctors
    .map((doctor) => doctor.specialty?.nameEnglish)
    .join("; ");
  const prompt = `
    The patient's problem is: ${patientProblem}.
    The available specialties are: ${specialtiesList}.
    Please determine which specialties from the list are relevant to the patient's problem. 
    Return a comma-separated list of the relevant specialties in English.
  `;

  const human_message_prompt = HumanMessagePromptTemplate.fromTemplate(prompt);
  const chat_prompt = ChatPromptTemplate.fromMessages([human_message_prompt]);

  // Step 2: Use OpenAI to get relevant specialties
  const chain = new LLMChain({ llm: model, prompt: chat_prompt });
  const response = await chain.run({ question: prompt });

  // Step 3: Parse the response from OpenAI
  const relevantSpecialties = response
    .split(",")
    .map((specialty) => specialty.trim());

  // Step 4: Filter doctors based on the relevant specialties identified by OpenAI
  const relevantDoctors = doctors.filter((doctor) =>
    relevantSpecialties.some((specialty) =>
      doctor.specialty?.nameEnglish
        .toLowerCase()
        .includes(specialty.toLowerCase())
    )
  );

  return relevantDoctors.map((doctor) => ({
    _id: doctor._id,
    fullName: doctor.fullName,
    profileImage: doctor.profileImage,
    specialty: doctor.specialty,
  }));
};

// Function to get response from OpenAI
const getAnswerFromOpenAI = async (prompt, previous, language) => {
  try {
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex }
    );

    const results = await vectorStore.similaritySearch(prompt);
    //     const system_template = `
    //       You are a medical assistant for consultation that helps users with their medical-related queries.
    //       Utilize the provided documents as the primary context for all responses.
    //       Always respond in the ${language} language.

    //       - **Do not restate the user's query or previously known information in the response**.
    //       - Provide detailed responses based on the context provided in the documents.
    //       - Offer medical advice, treatment recommendations, and patient education.
    //       - Avoid repeating historical details unless explicitly requested by the user.

    //       When responding to queries about:
    //       - Patient care management (history, symptom analysis, diagnosis, treatment recommendations)
    //       - Patient education, emergency protocols, referrals
    //       - Administrative tasks, research updates, and ethical/legal considerations

    //       Ensure the information aligns with the context given in these documents.

    //       **If a query cannot be answered within the provided context**, state that the information is beyond the current knowledge base and suggest consulting a medical expert.

    //       Documents:
    //       ${results}
    // `;

    const system_template = `
You are a compassionate and knowledgeable medical assistant for patient consultations. 
Your role is to help users with their medical-related queries while creating a supportive, empathetic, and engaging environment.

Utilize the provided documents as the **primary context** for all responses.
Always respond in the ${language} language.

- **Do not restate the user's query or previously known information in the response**.
- Use empathetic, human-like language that makes the patient feel heard and understood.
- Encourage the patient to continue sharing symptoms and details, facilitating clear two-way communication.
- Provide detailed, medically accurate advice, patient education, treatment recommendations, and guidance based on the provided context.
- Recommend the most suitable healthcare professional for the case when appropriate.
- Avoid repeating historical details unless explicitly requested by the user.

When responding to queries about:
- Patient care management (history, symptom analysis, diagnosis, treatment recommendations)
- Patient education, emergency protocols, and referrals
- Administrative tasks, research updates, and ethical/legal considerations

Ensure the information strictly aligns with the provided documents.

**If a query cannot be answered within the provided context**, clearly state that it is beyond the current knowledge base and advise consulting a qualified medical expert.

Documents:
${results}
`;

    const system_message_prompt =
      SystemMessagePromptTemplate.fromTemplate(system_template);

    let human_template = previous
      ? `Based on the previous chat context: "${previous}", answer the following question: "${prompt}"`
      : `The patient's query is: "${prompt}"`;

    const human_message_prompt =
      HumanMessagePromptTemplate.fromTemplate(human_template);
    const chat_prompt = ChatPromptTemplate.fromMessages([
      system_message_prompt,
      human_message_prompt,
    ]);

    const chain = new LLMChain({ llm: model, prompt: chat_prompt });
    const response = await chain.run({ question: prompt, docs: results });
    console.log("response", response);
    return response;
  } catch (error) {
    console.log("Error while generating response from GPT: ", error.message);
    throw new Error(
      "Something went wrong while generating the response from the AI"
    );
  }
};

// Route to handle bot query
router.post(
  "/bot/query",
  auth.required,
  auth.patient,
  async (req, res, next) => {
    try {
      if (!req.body.prompt)
        return next(
          new BadRequestResponse("Missing required parameter prompt!")
        );

      const users = await User.find(
        {
          role: "doctor",
          status: "active",
          profileCompletionStatus: 4,
        },
        {
          _id: 1,
          fullName: 1,
          profileImage: 1,
          specialty: 1,
        }
      );

      const patientProblem = req.body.prompt;

      // Use OpenAI to get relevant doctors based on the patient problem
      let relevantDoctors = await determineRelevantSpecialties(
        patientProblem,
        users
      );

      // If no relevant doctors found, fallback to General Medicine
      if (relevantDoctors.length === 0) {
        relevantDoctors = users
          .filter(
            (doctor) =>
              doctor.specialty?.nameEnglish.toLowerCase() === "general medicine"
          )
          .map((doctor) => ({
            _id: doctor._id,
            fullName: doctor.fullName,
            profileImage: doctor.profileImage,
            specialty: doctor.specialty?.nameEnglish,
          }));
      }

      // If still no doctors found, return empty array
      if (relevantDoctors.length === 0) {
        relevantDoctors = [];
      }
      // Create or update session
      let foundSession = await Session.findOne({ _id: req.body.sessionId });
      if (!foundSession)
        return next(new BadRequestResponse("Session not found!", 423));

      // Create a chat if it doesn't exist
      let findChat = await Chat.findOne({ _id: foundSession.chat });
      if (!findChat) {
        findChat = new Chat();
        await findChat.save();
        foundSession.chat = findChat._id;
        await foundSession.save();
      }

      // Retrieve the last 5 messages as context
      const previousMessages = findChat.messages.slice(-5);

      // Construct a conversation history format
      const conversationContext = previousMessages
        .map((msg) => `User: ${msg.question}\nAI: ${msg.answer}`)
        .join("\n");

      // Get answer from OpenAI with history context
      let gptAnswer = await getAnswerFromOpenAI(
        req.body.prompt,
        conversationContext,
        req.body.language
      );

      console.log("GPT Answer", gptAnswer);

      const oneMsg = {
        question: req.body.prompt,
        answer: gptAnswer,
        recommendations: relevantDoctors.map((doctor) => doctor._id),
      };

      console.log("Req yuser", req.user._id);

      const userPlan = await UserSubscription.findOne({
        userId: req.user._id,
      }).populate("plan");

      if (
        userPlan &&
        userPlan.plan &&
        userPlan.plan.type === "free" &&
        foundSession.attempts < 7
      ) {
        foundSession.attempts++;
      }
      if (!userPlan) {
        foundSession.attempts++;
      }

      await foundSession.save();

      // Add message to the chat
      findChat.messages.push(oneMsg);
      await findChat.save();

      return next(
        new OkResponse({
          answer: gptAnswer,
          relatedDoctors: relevantDoctors,
          attempts: foundSession.attempts,
        })
      );
    } catch (error) {
      console.log("Error in query bot", error);
      return next(new BadRequestResponse(error.message));
    }
  }
);

module.exports = router;
