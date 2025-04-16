import React, { useState, useRef, useEffect } from "react";
import { Grid, Avatar, Typography, Box } from "@mui/material";
import Attachment from "./Attachment";
import ChatInput from "./ChatInput";
import UserAvatar from "../Assets/UserAvatar.svg";
import createMessageBlock from "../utilities/createMessageBlock";
import { ALLOW_FILE_UPLOAD, ALLOW_VOICE_RECOGNITION, ALLOW_FAQ, WEBSOCKET_API } from "../utilities/constants";
import SpeechRecognitionComponent from "./SpeechRecognition";
import { FAQExamples } from "./index";
import StreamingResponse from "./BotStates/StreamingResponse";
import ThinkingResponse from "./BotStates/ThinkingResponse";
import InitialProcessing from "./BotStates/InitialProcessing";
import { v4 as uuidv4 } from "uuid";
import FileResponse from "./FileResponse";
const sessionId = uuidv4();
function ChatBody() {
  const [messageList, setMessageList] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [questionAsked, setQuestionAsked] = useState(false);
  const messagesEndRef = useRef(null);
  const ws = useRef(null);
  const messageBuffer = useRef("");

  useEffect(() => {
    scrollToBottom();
    console.log(messageList);
  }, [messageList]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSendMessage = (message) => {
    setProcessing(true);

    // Add user message to the list
    const userMessageBlock = createMessageBlock(message, "USER", "TEXT", "SENT");

    // Create a placeholder for bot response
    const botMessageBlock = createMessageBlock("", "BOT", "TEXT", "INITIAL_PROCESSING");

    setMessageList((prevList) => [...prevList, userMessageBlock, botMessageBlock]);

    // Send message to WebSocket if connected
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: "sendMessage", prompt: message, sessionId: sessionId }));
    }

    setQuestionAsked(true);
  };

  const handleFileUploadComplete = (file, fileStatus) => {
    const userFileMessage = createMessageBlock(`File uploaded: ${file.name}`, "USER", "FILE", "SENT", file.name, fileStatus);

    setMessageList((prevList) => [...prevList, userFileMessage]);
    setQuestionAsked(true);

    setTimeout(() => {
      let botMessage = "Checking file size.";
      let messageState = "RECEIVED";

      if (fileStatus === "File size limit exceeded.") {
        botMessage = "File size limit exceeded. Please upload a smaller file.";
      } else if (fileStatus !== "File page limit check succeeded.") {
        botMessage = "Network Error. Please try again later.";
      }

      const botFileMessage = createMessageBlock(botMessage, "BOT", "FILE", messageState, file.name, fileStatus);

      setMessageList((prevList) => [...prevList, botFileMessage]);
    }, 1000);
  };

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt);
  };

  useEffect(() => {
    ws.current = new WebSocket(WEBSOCKET_API);

    ws.current.onopen = () => {
      console.log("WebSocket Connected");
    };

    ws.current.onmessage = (event) => {
      try {
        messageBuffer.current += event.data;
        const parsedData = JSON.parse(messageBuffer.current);

        if (parsedData.type === "thinking") {
          // Update the last message (which should be the bot's response)
          setMessageList((prevList) => {
            const lastIndex = prevList.length - 1;
            const updatedList = [...prevList];

            if (lastIndex >= 0 && updatedList[lastIndex].sentBy === "BOT") {
              updatedList[lastIndex] = {
                ...updatedList[lastIndex],
                // Append new text to the thinking array
                thinking: [
                  ...updatedList[lastIndex].thinking, // Keep the previous thinking text
                  parsedData.text, // Add the new text
                ],
                state: "THINKING",
              };
            }
            return updatedList;
          });
        } else if (parsedData.type === "final_text") {
          // Mark the message as received when complete
          setMessageList((prevList) => {
            const lastIndex = prevList.length - 1;
            const updatedList = [...prevList];

            if (lastIndex >= 0 && updatedList[lastIndex].sentBy === "BOT") {
              updatedList[lastIndex] = {
                ...updatedList[lastIndex],
                message: updatedList[lastIndex].message + parsedData.text,
                state: parsedData.type === "final_text" ? "RECEIVED" : "STREAMING",
              };
            }
            return updatedList;
          });

          setProcessing(false);
        } else if (parsedData.type === "files") {
          //Remove duplicate files
          const uniqueFiles = parsedData.files.filter(
            (file, index, self) => index === self.findIndex((t) => t.filename === file.filename) // Check if the filename is unique
          );
          const fileMessageBlock = createMessageBlock("", "BOT", "FILE", "RECEIVED", uniqueFiles);
          setMessageList((prevList) => {
            return [...prevList, fileMessageBlock];
          });
        }

        messageBuffer.current = "";
      } catch (e) {
        if (e instanceof SyntaxError) {
          console.log("Received incomplete JSON, waiting for more data...");
        } else {
          console.error("Error processing message: ", e);
          messageBuffer.current = "";
        }
      }
    };

    ws.current.onerror = (error) => {
      console.log("WebSocket Error: ", error);
      setProcessing(false);
    };

    ws.current.onclose = (event) => {
      if (event.wasClean) {
        console.log(`WebSocket closed cleanly, code=${event.code}, reason=${event.reason}`);
      } else {
        console.log("WebSocket Disconnected unexpectedly");
      }
      setProcessing(false);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const getMessage = () => message;

  return (
    <>
      <Box display="flex" flexDirection="column" justifyContent="space-between" className="appHeight100 appWidth100">
        <Box className="chatScrollContainer appWidth100">
          <Box sx={{ display: ALLOW_FAQ ? "flex" : "none" }}>{!questionAsked && <FAQExamples onPromptClick={handlePromptClick} />}</Box>
          {messageList.map((msg, index) => (
            <Box key={index} mb={2}>
              {/* Case 1: If the message type is "file", handle it separately */}
              {msg.type === "FILE" ? (
                <FileResponse message={msg} />
              ) : // Case 2: Handle non-file messages (both User and Bot)

              // If the message is from the User:
              msg.sentBy === "USER" ? (
                <UserReply message={msg.message} type={msg.type} fileName={msg.fileName} />
              ) : (
                // If the message is from the Bot:
                msg.sentBy === "BOT" &&
                // Case 3: Bot message states (Initial, Thinking, Streaming)
                (msg.state === "INITIAL_PROCESSING" ? (
                  // Bot is in the initial processing state
                  <InitialProcessing />
                ) : msg.state === "THINKING" ? (
                  // Bot is thinking (waiting for response)
                  <ThinkingResponse message={msg} />
                ) : (
                  // Bot has finished streaming the response
                  <StreamingResponse message={msg} />
                ))
              )}
            </Box>
          ))}

          <div ref={messagesEndRef} />
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="flex-end" sx={{ flexShrink: 0 }}>
          <Box sx={{ display: ALLOW_VOICE_RECOGNITION ? "flex" : "none" }}>
            <SpeechRecognitionComponent setMessage={setMessage} getMessage={getMessage} />
          </Box>
          <Box sx={{ display: ALLOW_FILE_UPLOAD ? "flex" : "none" }} mr={2}>
            <Attachment onFileUploadComplete={handleFileUploadComplete} />
          </Box>
          <Box sx={{ width: "100%" }}>
            <ChatInput onSendMessage={handleSendMessage} processing={processing} message={message} setMessage={setMessage} />
          </Box>
        </Box>
      </Box>
    </>
  );
}

export default ChatBody; // User reply component
function UserReply({ message, type, fileName }) {
  return (
    <Grid container direction="row" justifyContent="flex-end" alignItems="flex-end">
      <Grid item className="userMessage" sx={{ backgroundColor: (theme) => theme.palette.background.userMessage }}>
        <Typography variant="body2">{type === "FILE" ? `File uploaded: ${fileName}` : message}</Typography>
      </Grid>
      <Grid item>
        <Avatar alt={"User Profile Pic"} src={UserAvatar} />
      </Grid>
    </Grid>
  );
}
