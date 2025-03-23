// client/src/services/api.js
import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 60000, // Long timeout for potentially slow responses
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

export const sendQuery = async (query, selectedAgents = ['general'], selectedSources = ['zoomCommunity', 'zoomSupport', 'google'], files = []) => {
  // Create form data
  const formData = new FormData();
  formData.append('query', query);
  formData.append('selectedAgents', JSON.stringify(selectedAgents));
  formData.append('selectedSources', JSON.stringify(selectedSources));
  
  // Add files if any
  if (files && files.length > 0) {
    files.forEach(file => {
      formData.append('files', file);
    });
  }
  
  try {
    const response = await api.post('/agent/query', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending query:', error);
    throw error;
  }
};

// client/src/components/Chat/ChatMessage.jsx
import React from 'react';
import { ExternalLink } from 'lucide-react';

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-3/4 rounded-lg p-3 ${
          isUser
            ? 'bg-blue-500 text-white'
            : isSystem
              ? 'bg-gray-100 text-gray-800 text-sm'
              : 'bg-white border border-gray-200 shadow-sm'
        }`}
      >
        {message.agents && (
          <div className="text-xs text-gray-500 mb-1">
            Agents: {message.agents.join(', ')}
          </div>
        )}
        
        <div className="whitespace-pre-line">{message.content}</div>
        
        {/* Sources section */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="text-xs font-medium text-gray-500 mb-1">Sources:</div>
            <div className="space-y-1">
              {message.sources.map((source, i) => (
                <div key={i} className="flex items-start">
                  <ExternalLink className="h-3 w-3 text-gray-400 mt-0.5 mr-1 flex-shrink-0" />
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate"
                  >
                    {source.title} <span className="text-gray-500">({source.source})</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;

// client/src/components/Chat/ChatInterface.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Search, Cpu, ChevronDown, X } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { sendQuery } from '../../services/api';

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Welcome to AI SearchEngine. Ask me anything about Zoom!' }
  ]);
  
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [selectedSources, setSelectedSources] = useState(['zoomCommunity', 'zoomSupport', 'google']);
  
  const messagesEndRef = useRef(null);
  
  const sources = [
    { id: 'zoomCommunity', name: 'Zoom Community', url: 'https://community.zoom.com/' },
    { id: 'zoomSupport', name: 'Zoom Support', url: 'https://support.zoom.com/hc' },
    { id: 'google', name: 'Google Search', url: 'https://www.google.com' }
  ];
  
  const handleSendMessage = async () => {
    if (input.trim() === '') return;
    
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    
    try {
      // Send query to backend
      const response = await sendQuery(input, ['general'], selectedSources, uploadedFiles);
      
      // Add response to messages
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        agents: ['General Agent']
      }]);
      
      // Clear uploaded files after sending
      setUploadedFiles([]);
    } catch (error) {
      console.error('Error processing message:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error.message || 'Failed to process your request. Please try again.'}`
      }]);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files]);
    
    // Add message about uploaded files
    if (files.length > 0) {
      const fileNames = files.map(f => f.name).join(', ');
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Files uploaded: ${fileNames}`
      }]);
    }
  };
  
  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const toggleSourceSelection = (sourceId) => {
    setSelectedSources(prev => {
      if (prev.includes(sourceId)) {
        return prev.filter(id => id !== sourceId);
      } else {
        return [...prev, sourceId];
      }
    });
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white shadow-sm py-3 px-6 flex justify-between items-center">
        <h1 className="text-xl font-semibold flex items-center">
          <Cpu className="h-6 w-6 mr-2 text-blue-500" />
          AI SearchEngine
        </h1>
        <div className="text-sm text-gray-500">Powered by ReAct & MCP Architecture</div>
      </header>
      
      <div className="flex-grow flex overflow-hidden">
        <main className="flex-grow flex flex-col max-w-4xl mx-auto w-full p-4">
          {/* Messages Display */}
          <div className="flex-grow overflow-y-auto p-2 space-y-4 bg-white rounded-lg shadow-sm">
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="max-w-3/4 rounded-lg p-3 bg-white border border-gray-200 shadow-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-75"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Uploaded Files Display */}
          {uploadedFiles.length > 0 && (
            <div className="bg-white rounded-lg mt-2 p-2 shadow-sm">
              <div className="text-xs font-medium text-gray-500 mb-1">Uploaded files:</div>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="bg-gray-100 rounded-md px-2 py-1 text-xs flex items-center shadow-sm">
                    <span className="truncate max-w-xs">{file.name}</span>
                    <button
                      className="ml-1 text-gray-400 hover:text-gray-600"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Source Selection */}
          <div className="flex flex-wrap mt-2 gap-2">
            <div className="relative">
              <button
                className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm flex items-center shadow-sm hover:bg-gray-50"
                onClick={() => setShowSourceSelector(!showSourceSelector)}
              >
                <Search className="h-4 w-4 mr-1.5 text-blue-500" />
                Sources ({selectedSources.length})
                <ChevronDown className="h-4 w-4 ml-1.5" />
              </button>
              
              {showSourceSelector && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 w-64 z-10">
                  <div className="p-2">
                    {sources.map(source => (
                      <div
                        key={source.id}
                        className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => toggleSourceSelection(source.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSources.includes(source.id)}
                          onChange={() => {}}
                          className="mr-2"
                        />
                        <span className="font-medium">{source.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Input Area */}
          <div className="mt-2 bg-white rounded-lg shadow-sm p-2 border border-gray-200">
            <div className="flex items-center space-x-2">
              <button
                className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                onClick={() => document.getElementById('file-upload').click()}
              >
                <Upload className="h-5 w-5" />
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </button>
              <input
                type="text"
                className="flex-grow p-2 outline-none"
                placeholder="Ask a question about Zoom..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                className={`p-2 rounded-full ${
                  input.trim() ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
                onClick={handleSendMessage}
                disabled={!input.trim() || isProcessing}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChatInterface;

// client/src/App.js
import React from 'react';
import ChatInterface from './components/Chat/ChatInterface';
import './styles/tailwind.css';

function App() {
  return (
    <div className="App">
      <ChatInterface />
    </div>
  );
}

export default App;