// --------------------------------------------------------------------------------------------------------//
// Primary color constants for the theme
export const PRIMARY_MAIN = "#1E50B4"; // The main primary color used for buttons, highlights, etc.
export const primary_50 = "#6f98ec"; // The 50 variant of the primary color

// Background color constants
export const SECONDARY_MAIN = "#D3D3D3"; // The main secondary color used for less prominent elements

// Chat component background colors
export const CHAT_BODY_BACKGROUND = "#FFFFFF"; // Background color for the chat body area
export const CHAT_LEFT_PANEL_BACKGROUND = "#F7F9FE"; // Background color for the left panel in the chat
export const ABOUT_US_HEADER_BACKGROUND = "#316ADD"; // Background color for the About Us section in the left panel
export const FAQ_HEADER_BACKGROUND = "#316ADD"; // Background color for the FAQ section in the left panel
export const ABOUT_US_TEXT = "#000000"; // Text color for the About Us section in the left panel
export const FAQ_TEXT = "#000000"; // Text color for the FAQ section in the left panel
export const HEADER_BACKGROUND = "#DDE8FE"; // Background color for the header
export const HEADER_TEXT_GRADIENT = "#316ADD"; // Text gradient color for the header

// Message background colors
export const BOTMESSAGE_BACKGROUND = "#F5F5F5"; // Background color for messages sent by the bot
export const USERMESSAGE_BACKGROUND = "#ddebff"; // Background color for messages sent by the user

// --------------------------------------------------------------------------------------------------------//
// --------------------------------------------------------------------------------------------------------//

// Text Constants
export const TEXT = {
  EN: {
    APP_NAME: "Chatbot Template App",
    APP_ASSISTANT_NAME: "GenAI Bot",
    ABOUT_US_TITLE: "About us",
    ABOUT_US:
      "The Department of Corrections AI Assistant is a real-time data retrieval system that enhances access to inmate population insights. It enables users to explore crime statistics, incarceration trends, legal updates, and release schedules using publicly available data. This tool is built on a limited publicly available dataset from the California Department of Corrections and Rehabilitation.",
    FAQ_TITLE: "Frequently Asked Questions",
    FAQS: ["What are the top offenses?", "Compare the suicide rate for 2015 and then the previous year", "Summarize 2021 Annual Report on Suicides in the CDCR", "What is the average daily population?"],
    CHAT_HEADER_TITLE: "Department of Corrections AI Assistant",
    CHAT_INPUT_PLACEHOLDER: "Type a Query...",
    HELPER_TEXT: "Cannot send empty message",
    SPEECH_RECOGNITION_START: "Start Listening",
    SPEECH_RECOGNITION_STOP: "Stop Listening",
    SPEECH_RECOGNITION_HELPER_TEXT: "Stop speaking to send the message", // New helper text
  },
  ES: {
    APP_NAME: "Aplicación de Chatbot",
    APP_ASSISTANT_NAME: "Bot GenAI",
    ABOUT_US_TITLE: "Sobre nosotros",
    ABOUT_US:
      "El Asistente de IA del Departamento de Correcciones es un sistema de recuperación de datos en tiempo real que mejora el acceso a información sobre la población penitenciaria. Permite a los usuarios explorar estadísticas de delitos, tendencias de encarcelamiento, actualizaciones legales y calendarios de liberación utilizando datos públicos disponibles. Esta herramienta se basa en un conjunto de datos públicos limitados del Departamento de Correcciones y Rehabilitación de California",
    FAQ_TITLE: "Preguntas Frecuentes",
    FAQS: ["¿Qué es el Asistente de IA del Departamento de Correcciones?", "¿Puedo buscar información sobre un recluso específico?", "¿Cuáles son los diez delitos más comunes por ciudad o condado?", "Muéstrame un gráfico de la duración promedio del tiempo en el corredor de la muerte en los últimos 25 años, desglosado por condado"],
    CHAT_HEADER_TITLE: "Asistente de IA del Departamento de Correcciones",
    CHAT_INPUT_PLACEHOLDER: "Escribe una consulta...",
    HELPER_TEXT: "No se puede enviar un mensaje vacío",
    SPEECH_RECOGNITION_START: "Iniciar Escucha",
    SPEECH_RECOGNITION_STOP: "Detener Escucha",
    SPEECH_RECOGNITION_HELPER_TEXT: "Deja de hablar para enviar el mensaje", // Nuevo texto de ayuda
  },
};

export const SWITCH_TEXT = {
  SWITCH_LANGUAGE_ENGLISH: "English",
  SWITCH_TOOLTIP_ENGLISH: "Language",
  SWITCH_LANGUAGE_SPANISH: "Español",
  SWITCH_TOOLTIP_SPANISH: "Idioma",
};

export const LANDING_PAGE_TEXT = {
  EN: {
    CHOOSE_LANGUAGE: "Choose language:",
    ENGLISH: "English",
    SPANISH: "Español",
    SAVE_CONTINUE: "Save and Continue",
    APP_ASSISTANT_NAME: "Sample GenAI Bot Landing Page",
  },
  ES: {
    CHOOSE_LANGUAGE: "Elige el idioma:",
    ENGLISH: "English",
    SPANISH: "Español",
    SAVE_CONTINUE: "Guardar y continuar",
    APP_ASSISTANT_NAME: "Bot GenAI de Ejemplo Página de Inicio",
  },
};

// --------------------------------------------------------------------------------------------------------//
// --------------------------------------------------------------------------------------------------------//

// API endpoints

export const CHAT_API = process.env.REACT_APP_CHAT_API; // URL for the chat API endpoint
export const WEBSOCKET_API = process.env.REACT_APP_WEBSOCKET_API; // URL for the WebSocket API endpoint

// --------------------------------------------------------------------------------------------------------//
// --------------------------------------------------------------------------------------------------------//

// Features
export const ALLOW_FILE_UPLOAD = false; // Set to true to enable file upload feature
export const ALLOW_VOICE_RECOGNITION = false; // Set to true to enable voice recognition feature

export const ALLOW_MULTLINGUAL_TOGGLE = false; // Set to true to enable multilingual support
export const ALLOW_LANDING_PAGE = false; // Set to true to enable the landing page

// --------------------------------------------------------------------------------------------------------//
// Styling under work, would reccomend keeping it false for now
export const ALLOW_MARKDOWN_BOT = true; // Set to true to enable markdown support for bot messages
export const ALLOW_FAQ = true; // Set to true to enable the FAQs to be visible in Chat body
export const SHOW_FAQ_LEFT_NAV = false;
