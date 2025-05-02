import React, { useState, useEffect } from 'react';
import './App.css'; 
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Define interfaces for the data structure
interface ConversationPart {
  text: string;
}

interface ConversationTurn {
  role: string; // "user" or "model"
  parts: ConversationPart[];
}

interface SessionRequest {
  sessionId: string | null;
  directoryPath: string | null;
  currentPrompt: string;
}

interface SessionResponse {
  sessionId: string;
  modelResponse: string;
  fullConversationHistory: ConversationTurn[]; // Now included in the response
}

// Interface for storing conversation list in localStorage
interface StoredConversation {
  id: string;
  title: string; // A simple title for the conversation
}

const App: React.FC = () => {
  // State variables
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null); // ID of the active conversation
  const [directoryPath, setDirectoryPath] = useState<string>('');
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [historyDisplay, setHistoryDisplay] = useState<ConversationTurn[]>([]); // History for the *currently loaded* conversation
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for the list of all conversations in the side panel
  const [conversations, setConversations] = useState<StoredConversation[]>([]);

  // URL of your local Azure Function endpoint
  const functionUrl = 'http://localhost:7092/api/FileReader'; 

  // --- useEffect to load conversations from localStorage on component mount ---
  useEffect(() => {
    const storedConversations = localStorage.getItem('geminiConversations');
    if (storedConversations) {
      try {
        const parsedConversations: StoredConversation[] = JSON.parse(storedConversations);
         // Basic validation of loaded data structure
        if (Array.isArray(parsedConversations) && parsedConversations.every(c => typeof c.id === 'string' && typeof c.title === 'string')) {
           setConversations(parsedConversations);
        } else {
           console.error('Invalid data found in localStorage for geminiConversations');
           // Optionally clear invalid data
           // localStorage.removeItem('geminiConversations');
        }
      } catch (e) {
        console.error('Failed to parse conversations from localStorage:', e);
        // Optionally clear invalid data
        // localStorage.removeItem('geminiConversations');
      }
    }
  }, []); // Empty dependency array means this runs only once on mount


  // --- useEffect to save conversations to localStorage whenever the list changes ---
  useEffect(() => {
    try {
      localStorage.setItem('geminiConversations', JSON.stringify(conversations));
    } catch (e) {
      console.error('Failed to save conversations to localStorage:', e);
    }
  }, [conversations]); // Dependency array ensures this runs whenever 'conversations' state changes


  // --- Function to handle sending prompt to backend ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPrompt.trim() && !directoryPath.trim() && historyDisplay.length === 0) {
       // If no prompt, no directory, AND no existing history, require prompt/directory
      setError('Please provide a prompt and/or a directory path to start or continue.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const requestBody: SessionRequest = {
      sessionId: currentSessionId, // Use the current active session ID
      directoryPath: directoryPath.trim() === '' ? null : directoryPath.trim(), // Send null if input is empty
      currentPrompt: currentPrompt.trim(),
    };

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text(); // Get error as text
        throw new Error(`API Error ${response.status}: ${errorData}`);
      }

      const responseData: SessionResponse = await response.json();

      // Update state
      const newSessionId = responseData.sessionId;
      const updatedHistory = responseData.fullConversationHistory; // Get the full updated history

      setCurrentSessionId(newSessionId); // Set or update the active session ID
      setHistoryDisplay(updatedHistory); // Display the full conversation history
      

      // --- Update conversation list in side panel ---
      setConversations(prevConversations => {
        // Check if this session ID already exists in the list
        const existingConversationIndex = prevConversations.findIndex(conv => conv.id === newSessionId);

        if (existingConversationIndex === -1) {
          // If it's a new session, add it to the list
          // Try to generate a simple title from the first user prompt
          const firstUserTurn = updatedHistory.find(turn => turn.role === 'user');
          const title = firstUserTurn?.parts?.[0]?.text.substring(0, 50) + '...' || 'New Chat';
          const newConversation: StoredConversation = { id: newSessionId, title: title };
          return [...prevConversations, newConversation]; // Add to the end
        } else {
          // If it's an existing session, potentially update its title
          // (Optional, could update title based on first prompt or just leave it)
           const firstUserTurn = updatedHistory.find(turn => turn.role === 'user');
           const newTitle = firstUserTurn?.parts?.[0]?.text.substring(0, 50) + '...' || prevConversations[existingConversationIndex].title;

           const updatedConversations = [...prevConversations];
           updatedConversations[existingConversationIndex] = { ...updatedConversations[existingConversationIndex], title: newTitle };
           return updatedConversations;
        }
      });

      // Clear input fields after sending
      //setDirectoryPath('');
      setCurrentPrompt('');

    } catch (err: any) {
      console.error('Error calling function:', err);
      setError(err.message || 'An unknown error occurred.');
      setIsLoading(false); // Ensure loading state is cleared on error
    } finally {
      // If error occurred, finally block runs, but we clear loading in catch too.
      // If successful, loading is cleared here.
       setIsLoading(false);
    }
  };

  // --- Function to handle clicking a conversation in the side panel ---
  const handleLoadConversation = async (sessionIdToLoad: string) => {
     if (isLoading || currentSessionId === sessionIdToLoad) return; // Don't load if busy or already active

     setIsLoading(true);
     setError(null);
     

     // To load a conversation's history, we need to make a request to the backend.
     // The backend's current logic expects a prompt, even if just to return history.
     // A more ideal backend might have a separate endpoint like GET /api/history/{sessionId}
     // But with the current POST endpoint, we send an empty prompt.
     const requestBody: SessionRequest = {
       sessionId: sessionIdToLoad,
       directoryPath: null, // Don't re-process directory on load
       currentPrompt: '', // Send an empty prompt to trigger history load/return
     };

     try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API Error ${response.status}: ${errorData}`);
        }

        const responseData: SessionResponse = await response.json();

        // Set the loaded session as the current one
        setCurrentSessionId(responseData.sessionId);
        // Display the loaded history
        setHistoryDisplay(responseData.fullConversationHistory);
        // Clear prompt/directory inputs when loading a new conversation
        setDirectoryPath('');
        setCurrentPrompt('');
        

        //log.logInformation(`Loaded conversation: ${responseData.sessionId}`); // This log won't show in browser console directly, but good practice

     } catch (err: any) {
        console.error('Error loading conversation:', err);
        setError(`Failed to load conversation: ${err.message || 'Unknown error'}`);
     } finally {
        setIsLoading(false);
     }
  };


  // --- Function to start a brand new conversation ---
  const handleNewConversation = () => {
     if (isLoading) return;
     setCurrentSessionId(null); // Set session ID to null to signal a new conversation on next submit
     setHistoryDisplay([]); // Clear the displayed history
     setDirectoryPath(''); // Clear directory path
     setCurrentPrompt(''); // Clear prompt
     
     setError(null); // Clear any errors
     console.log('Ready to start a new conversation.');
  };


  // --- Basic CSS for layout (create App.css) ---
  // This is just a simple example. More robust CSS frameworks are recommended for real apps.


  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>Conversations</h2>
        <button onClick={handleNewConversation} disabled={isLoading} className="new-chat-button">+ New Chat</button>
        <ul className="conversation-list">
          {conversations.map(conv => (
            <li
              key={conv.id}
              className={`conversation-item ${conv.id === currentSessionId ? 'active' : ''}`}
              onClick={() => handleLoadConversation(conv.id)}
            >
              {conv.title || 'Untitled Chat'}
            </li>
          ))}
        </ul>
      </div>

      <div className="main-content">
        <h1>Gemini Directory Processor</h1>
        <p style={{ color: 'red' }}><strong>Security Warning:</strong> File system access from a web request is highly insecure for production. This is for local testing only.</p>

        {/* Display conversation history */}
        <div className="conversation-history">
        <h2>Conversation History</h2>
   {historyDisplay.length === 0 && !isLoading && !error && (
      <p>Start a new conversation by entering a prompt and/or directory path, or select one from the sidebar.</p>
   )}
  {historyDisplay.map((turn, index) => (
    <div key={index} className={`conversation-turn ${turn.role}`}>
      <strong>{turn.role === 'user' ? 'You' : 'Gemini'}:</strong>
      {/* Display parts based on their index and content */}
      {turn.parts.map((part, partIndex) => {
          // If this is a user turn AND it's the first part (index 0)...
          if (turn.role === 'user' && partIndex === 0) {
               // This part should contain the combined file content (assuming backend structure)
               // Check if it actually looks like the file content part (starts with the directory prefix or file marker)
               if (part.text.trim().startsWith('Regarding the content of the files in the directory') ||
                   part.text.trim().startsWith('--- Start File:'))
               {
                   // Try to extract the directory name from the specific prefix added in the backend
                   const dirPrefixMatch = part.text.match(/^Regarding the content of the files in the directory '(.*?)':/);
                   const dirName = dirPrefixMatch ? dirPrefixMatch[1] : 'directory'; // Use extracted name or fallback

                   // Render a concise indicator for the file content part
                   return (
                       <p key={partIndex} style={{ fontStyle: 'italic', color: '#555' }}>
                           [Content from files in directory '{dirName}' - {part.text.length} characters included]
                       </p>
                   );
               } else {
                  // If it's the first part but doesn't look like file content, render it normally
                  return (
                       <ReactMarkdown key={partIndex}remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
                   );
               }
          } else {
              // If it's NOT the first part of a user turn, or it's a model turn
              // This part should contain the user's actual typed prompt or model's response
              return (
                  <ReactMarkdown key={partIndex}remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown> // Render the text normally
              );
          }
      })}
    </div>
  ))}
        </div>
        <div className="bottom-input-area">
        {/* Display error message */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="input-form">
           {/* Session ID input is now hidden */}
          <div style={{display: 'none'}}>
             <label htmlFor="sessionId">Session ID:</label>
             <input
               id="sessionId"
               type="text"
               value={currentSessionId || ''}
               readOnly // Make it read-only as user doesn't input it directly
             />
           </div>
            <div className="chat-input-wrapper">
            <textarea
              id="directoryPath"
              value={directoryPath}
              onChange={(e) => setDirectoryPath(e.target.value)}
              disabled={isLoading}
              placeholder="Directory path (optional)"
              className="directory-input"
            />
            <div className="textarea-button-container">
            <textarea
              id="currentPrompt"
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.target.value)}
              disabled={isLoading}
              rows={2}
              placeholder={historyDisplay.length > 0 ? "Continue the conversation..." : "Enter your prompt here..."}
              className="prompt-input"
            ></textarea>
            <button type="submit" disabled={isLoading || (!currentPrompt.trim() && !directoryPath.trim() && historyDisplay.length === 0)}
            className="send-button">
            {isLoading ? '...' : '→'}
          </button>
            </div>
            </div>
        </form>
        </div>

      </div>
    </div>
  );
};

export default App;